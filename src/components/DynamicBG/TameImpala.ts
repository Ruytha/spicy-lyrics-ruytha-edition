import "../../css/TameImpala.css";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { GetAppliedLyrics, type LyricsData } from "../../utils/Lyrics/Global/Applyer.ts";
import { $tameImpalaMode } from "../../utils/stores.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { PageContainer } from "../Pages/PageView.ts";
import { GetBeatPulse } from "./dynamicBackground.ts";

// Songs by Tame Impala, featuring them, or written by Kevin Parker get the look of the
// Currents cover: thin coloured lines flowing across the page and bending around a
// slowly drifting sphere, rippling harder on each beat; the playing lyric splits into red
// and cyan like a psychedelic print; and a banner says so when the song starts.

const TAME_IMPALA_ID = "5INjqkS1o8h1imAzPqGZBb";
// Credits write him as "Kevin Parker" or "Kevin R. Parker".
const KEVIN_PARKER = /\bkevin\s+(?:[a-z]\.?\s+)?parker\b/i;
const PAGE_CLASS = "TameImpala";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** The field: line count, and the canvas drawn at this fraction of the page's pixels. */
const LINES = 34;
const SCALE = 0.5;
const FRAME_S = 1 / 30;
/** Hue of the first line, sweeping over the rest (Currents: violet through magenta to orange). */
const HUE_FROM = 285;
const HUE_SPAN = 125;
/** Degrees a second the palette drifts. */
const HUE_DRIFT = 6;

let lastKey = "";
let active = false;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let lastDraw = 0;
let ripple = 0;

type ArtistItem = { uri?: string; name?: string };

/** Whether the playing song is Tame Impala's, has them on it, or was written by Kevin Parker. */
function isTameImpala(lyrics: LyricsData | null): boolean {
  const item = Spicetify?.Player?.data?.item as
    | { artists?: ArtistItem[]; metadata?: Record<string, string> }
    | undefined;
  const artists = item?.artists ?? [];
  if (artists.some((a) => a.uri?.endsWith(`:${TAME_IMPALA_ID}`) || a.name?.toLowerCase() === "tame impala")) return true;
  // Spotify's metadata also lists every artist's uri, for songs where `artists` is cut short.
  const meta = item?.metadata ?? {};
  if (Object.entries(meta).some(([k, v]) => k.startsWith("artist_uri") && v.endsWith(`:${TAME_IMPALA_ID}`))) return true;
  const writers = (lyrics as { SongWriters?: string[] } | null)?.SongWriters ?? [];
  return writers.some((w) => KEVIN_PARKER.test(w));
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  const box = PageContainer?.querySelector<HTMLElement>(".ContentBox");
  if (!box) return null;
  if (!canvas || canvas.parentElement !== box) {
    canvas?.remove();
    canvas = box.ownerDocument.createElement("canvas");
    canvas.className = "SL_TameCurrents";
    canvas.setAttribute("aria-hidden", "true");
    box.appendChild(canvas);
    ctx = canvas.getContext("2d");
    // Fades in on the next frame.
    requestAnimationFrame(() => canvas?.classList.add("Visible"));
  }
  const w = Math.max(1, Math.round(box.clientWidth * SCALE));
  const h = Math.max(1, Math.round(box.clientHeight * SCALE));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return ctx;
}

function removeCanvas() {
  const leaving = canvas;
  canvas = null;
  ctx = null;
  if (!leaving) return;
  leaving.classList.remove("Visible");
  setTimeout(() => leaving.remove(), 900);
}

/**
 * One frame of the field. Every line runs left to right; near the sphere it's pushed
 * above or below it, the way the Currents lines bend around the ball. A slow wave runs
 * along each, and the beat (`ripple`) makes it swell.
 */
function draw(t: number) {
  const c = ensureCanvas();
  if (!c || !canvas) return;
  const { width: w, height: h } = canvas;
  c.clearRect(0, 0, w, h);

  // The sphere wanders on a slow figure of eight.
  const bx = w * (0.5 + 0.28 * Math.sin(t * 0.07));
  const by = h * (0.5 + 0.22 * Math.sin(t * 0.14 + 1.2));
  const radius = Math.min(w, h) * (0.13 + 0.03 * ripple);
  const spacing = h / LINES;
  const step = Math.max(4, Math.round(w / 140));
  const amp = spacing * (0.35 + 1.4 * ripple);

  c.lineWidth = Math.max(1, 1.6 * SCALE * 2);
  c.lineCap = "round";
  for (let i = 0; i < LINES; i++) {
    const y0 = (i + 0.5) * spacing;
    const hue = (HUE_FROM + (i / LINES) * HUE_SPAN + t * HUE_DRIFT) % 360;
    // Lines near the sphere glow brighter, like light caught on it.
    const near = Math.max(0, 1 - Math.abs(y0 - by) / (radius * 2.2));
    c.strokeStyle = `hsla(${hue}, 95%, ${62 + near * 12}%, ${0.16 + near * 0.16})`;
    c.beginPath();
    for (let x = -step; x <= w + step; x += step) {
      const dx = x - bx;
      const dy0 = y0 - by;
      // Pushed away from the sphere's centre, strongest right at it.
      const reach = radius * radius * 1.6;
      const push = (reach / (dx * dx + dy0 * dy0 + reach * 0.35)) * radius * 0.55;
      const side = dy0 === 0 ? 1 : Math.sign(dy0);
      const wave = Math.sin(x * 0.012 + t * 0.9 + i * 0.35) * amp * 0.5;
      const y = y0 + side * push + wave;
      if (x === -step) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }

  // The sphere itself: a soft dark disc with a lit rim, so the bending reads.
  const rim = c.createRadialGradient(bx, by, radius * 0.55, bx, by, radius * 1.05);
  rim.addColorStop(0, "rgba(10, 6, 20, 0.35)");
  rim.addColorStop(0.85, "rgba(10, 6, 20, 0.15)");
  rim.addColorStop(1, `hsla(${(HUE_FROM + t * HUE_DRIFT + 40) % 360}, 95%, 70%, 0.25)`);
  c.fillStyle = rim;
  c.beginPath();
  c.arc(bx, by, radius, 0, Math.PI * 2);
  c.fill();
}

function showBanner() {
  if (!PageContainer) return;
  PageContainer.querySelector(".SL_TameBanner")?.remove();
  const banner = PageContainer.ownerDocument.createElement("div");
  banner.className = "SL_TameBanner";
  banner.setAttribute("role", "status");
  banner.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 8c3-3 5 3 8 0s5-3 8 0 4 1 4 1"/><path d="M2 12c3-3 5 3 8 0s5-3 8 0 4 1 4 1"/><path d="M2 16c3-3 5 3 8 0s5-3 8 0 4 1 4 1"/></svg>
    <span class="SL_TameBanner_Title">Tame Impala</span>`;
  PageContainer.appendChild(banner);
  setTimeout(() => banner.classList.add("Leaving"), 4200);
  setTimeout(() => banner.remove(), 5000);
}

function setActive(on: boolean) {
  if (on === active) return;
  active = on;
  PageContainer?.classList.toggle(PAGE_CLASS, on);
  if (on) showBanner();
  else removeCanvas();
}

let lastPage: HTMLElement | null = null;

onAnimationFrame((timestamp) => {
  // A new page (opened again, or rebuilt for fullscreen) starts without the effect.
  if (PageContainer !== lastPage) {
    lastPage = PageContainer ?? null;
    active = false;
    canvas = null;
    ctx = null;
    lastKey = "";
  }
  if (!PageContainer) return;
  // Re-checked when the song or its lyrics (with their songwriters) change.
  const lyrics = GetAppliedLyrics();
  const key = `${SpotifyPlayer.GetUri() ?? ""}|${lyrics ? "lyrics" : "none"}|${$tameImpalaMode.get()}`;
  if (key !== lastKey) {
    lastKey = key;
    setActive($tameImpalaMode.get() && isTameImpala(lyrics));
  }
  if (!active || PageContainer.ownerDocument.hidden) return;

  const t = timestamp / 1000;
  // Reduced motion: the field holds still, drawn once.
  if (reducedMotion.matches) {
    if (!canvas) draw(0);
    return;
  }
  if (t - lastDraw < FRAME_S) return;
  lastDraw = t;
  // Rises with each beat and settles between them, so the lines swell on the beat.
  const pulse = SpotifyPlayer.IsPlaying ? GetBeatPulse() : 0;
  ripple = Math.max(pulse, ripple * 0.9);
  draw(t);
});

$tameImpalaMode.listen(() => {
  lastKey = "";
});

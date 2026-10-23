import "../../css/RuythaSpotlight.css";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { GetAppliedLyrics, type LyricsData } from "../../utils/Lyrics/Global/Applyer.ts";
import { $ruythaSpotlight } from "../../utils/stores.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { PageContainer } from "../Pages/PageView.ts";
import { GetBeatPulse } from "./dynamicBackground.ts";

// Songs synced by Ruytha, who makes this fork, get a spotlight for everyone using it:
// a banner on arrival, shooting stars across the sky that launch on the beat, and a
// ring around Ruytha's name in the credits.

type Role = "Maker" | "Uploader";

/** Ruytha's TTML profile id, as it appears in the credits' Maker and Uploader. */
const RUYTHA_ID = "690508522395402260";

const PAGE_CLASS = "RuythaSync";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Shooting star tuning, in CSS pixels and seconds. */
const STAR_LIFE = 1.1;
const STAR_MIN_GAP = 0.45;
/** Beats this strong (0..1+) launch a star; without beats, one drifts by every few seconds. */
const STAR_BEAT_THRESHOLD = 0.5;
const STAR_IDLE_GAP = [2.2, 4.2];
/** The canvas is drawn at this fraction of the page's pixels; streaks don't need more. */
const SKY_SCALE = 0.6;

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  born: number;
  hue: number;
}

let lastLyrics: LyricsData | null = null;
let roles: Role[] = [];
let sky: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let stars: Star[] = [];
let lastLaunch = 0;
let nextIdleLaunch = 0;
let lastPulse = 0;

/** Which credits on these lyrics are Ruytha's, if any. */
function ruythaRoles(lyrics: LyricsData | null): Role[] {
  const meta = lyrics?.TTMLUploadMetadata;
  if (!meta) return [];
  return (["Maker", "Uploader"] as Role[]).filter((role) => String(meta[role]?.id) === RUYTHA_ID);
}

function ensureSky(): CanvasRenderingContext2D | null {
  const box = PageContainer?.querySelector<HTMLElement>(".ContentBox");
  if (!box) return null;
  if (!sky || sky.parentElement !== box) {
    sky?.remove();
    sky = box.ownerDocument.createElement("canvas");
    sky.className = "SL_RuythaSky";
    box.appendChild(sky);
    ctx = sky.getContext("2d");
  }
  const w = Math.round(box.clientWidth * SKY_SCALE);
  const h = Math.round(box.clientHeight * SKY_SCALE);
  if (sky.width !== w || sky.height !== h) {
    sky.width = w;
    sky.height = h;
  }
  return ctx;
}

function removeSky() {
  sky?.remove();
  sky = null;
  ctx = null;
  stars = [];
}

/** A streak entering from the top edge, heading down and across at a shallow angle. */
function launch(now: number, width: number, height: number) {
  const leftward = Math.random() < 0.5;
  const angle = (18 + Math.random() * 22) * (Math.PI / 180);
  const speed = (0.9 + Math.random() * 0.7) * Math.max(width, 600);
  stars.push({
    x: leftward ? width * (0.35 + Math.random() * 0.75) : width * (-0.1 + Math.random() * 0.75),
    y: -20 + Math.random() * height * 0.35,
    vx: Math.cos(angle) * speed * (leftward ? -1 : 1),
    vy: Math.sin(angle) * speed,
    length: (0.09 + Math.random() * 0.08) * width,
    born: now,
    // ruytha.dev's sky blues through to its pink.
    hue: [210, 222, 258, 330][(Math.random() * 4) | 0],
  });
  lastLaunch = now;
  nextIdleLaunch = now + STAR_IDLE_GAP[0] + Math.random() * (STAR_IDLE_GAP[1] - STAR_IDLE_GAP[0]);
}

function drawSky(now: number) {
  const c = ensureSky();
  if (!c || !sky) return;
  const { width, height } = sky;

  const pulse = GetBeatPulse();
  const rising = pulse > STAR_BEAT_THRESHOLD && lastPulse <= STAR_BEAT_THRESHOLD;
  lastPulse = pulse;
  if (SpotifyPlayer.IsPlaying && now - lastLaunch > STAR_MIN_GAP) {
    // Songs whose beats never get that strong (or Pulse to the Beat off) still get the idle ones.
    if (rising || now > nextIdleLaunch) launch(now, width, height);
  }

  c.clearRect(0, 0, width, height);
  stars = stars.filter((s) => now - s.born < STAR_LIFE);
  c.lineCap = "round";
  for (const s of stars) {
    const age = now - s.born;
    const t = age / STAR_LIFE;
    const x = s.x + s.vx * age;
    const y = s.y + s.vy * age;
    const speed = Math.hypot(s.vx, s.vy);
    const tx = x - (s.vx / speed) * s.length;
    const ty = y - (s.vy / speed) * s.length;
    // Bright quickly, then fades as it burns out.
    const alpha = Math.min(1, t * 6) * (1 - t) ** 1.4;
    const tail = c.createLinearGradient(x, y, tx, ty);
    tail.addColorStop(0, `hsla(${s.hue}, 100%, 95%, ${alpha})`);
    tail.addColorStop(0.3, `hsla(${s.hue}, 95%, 82%, ${alpha * 0.6})`);
    tail.addColorStop(1, `hsla(${s.hue}, 90%, 72%, 0)`);
    // A soft glow so the streak still reads over a bright cover.
    c.shadowColor = `hsla(${s.hue}, 100%, 80%, ${alpha})`;
    c.shadowBlur = 14;
    c.strokeStyle = tail;
    c.lineWidth = 3.4;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(tx, ty);
    c.stroke();
    c.fillStyle = `hsla(${s.hue}, 100%, 97%, ${alpha})`;
    c.beginPath();
    c.arc(x, y, 3.6, 0, Math.PI * 2);
    c.fill();
  }
  c.shadowBlur = 0;
}

/** "Synced by Ruytha", shown for a few seconds when one of Ruytha's songs comes up. */
function showBanner() {
  if (!PageContainer) return;
  PageContainer.querySelector(".SL_RuythaBanner")?.remove();
  const banner = PageContainer.ownerDocument.createElement("div");
  banner.className = "SL_RuythaBanner";
  banner.setAttribute("role", "status");
  const made = roles.includes("Maker");
  banner.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.6 6.1 6.6.6-5 4.4 1.5 6.5L12 16.7l-5.7 3.4 1.5-6.5-5-4.4 6.6-.6z"/></svg>
    <span class="SL_RuythaBanner_Title"></span>
    <span class="SL_RuythaBanner_Name"></span>`;
  banner.querySelector(".SL_RuythaBanner_Title")!.textContent = made ? "Synced by Ruytha" : "Uploaded by Ruytha";
  banner.querySelector(".SL_RuythaBanner_Name")!.textContent = "@ruytha";
  PageContainer.appendChild(banner);
  setTimeout(() => banner.classList.add("Leaving"), 4200);
  setTimeout(() => banner.remove(), 5000);
}

/** Rings Ruytha's name in the credits; they're built after the lyrics, so this retries each frame. */
function markCredits() {
  for (const role of roles) {
    const button = PageContainer?.querySelector<HTMLElement>(`.SongInfo .${role} .song-info-profile-section`);
    if (button && !button.classList.contains("IsRuytha")) button.classList.add("IsRuytha");
  }
}

onAnimationFrame((timestamp) => {
  const lyrics = PageContainer ? GetAppliedLyrics() : null;
  if (lyrics !== lastLyrics) {
    lastLyrics = lyrics;
    roles = $ruythaSpotlight.get() ? ruythaRoles(lyrics) : [];
    PageContainer?.classList.toggle(PAGE_CLASS, roles.length > 0);
    if (roles.length > 0) {
      showBanner();
      if (!reducedMotion.matches && ensureSky() && sky) {
        // A small burst to greet it.
        for (let i = 0; i < 5; i++) launch(timestamp / 1000 - i * 0.12, sky.width, sky.height);
      }
    } else {
      removeSky();
    }
  }
  if (roles.length === 0 || !PageContainer) return;
  markCredits();
  if (reducedMotion.matches || document.hidden) return;
  drawSky(timestamp / 1000);
});

// Switching the spotlight on or off re-checks the song on screen.
const recheck = () => {
  lastLyrics = null;
  PageContainer?.querySelectorAll(".song-info-profile-section.IsRuytha").forEach((el) => el.classList.remove("IsRuytha"));
};
$ruythaSpotlight.listen(recheck);

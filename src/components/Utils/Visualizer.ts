// Visualizer for songs without lyrics (Settings → Cover). The page can't hear the audio, so
// it follows Spotify's analysis of the song instead: its loudness over time, the notes
// sounding in each slice and the beat. Those become one set of levels that every style
// draws from:
//   Bars     a row of bars along the bottom, mirrored out from the middle.
//   Terrain  the levels as ridges on a landscape in perspective, older ones receding.
//   Sphere   a turning globe of points around the cover that swells with the song.
//   Tunnel   rings shaped by the levels, flying out from behind the cover.
// Songs without an analysis (local files) get a slow wave while they play.
import type { AudioAnalysisData, Beat, Segment } from "../DynamicBG/BackgroundAnimationController.ts";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { getDynamicAudioAnalysis } from "../../utils/audioAnalysis.ts";
import { IsShowingNoLyrics } from "../../utils/Lyrics/LyricsNotice.ts";
import { $noLyricsVisualizer } from "../../utils/stores.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { IsCardMode, PageContainer } from "../Pages/PageView.ts";
import { IsCompactMode } from "./CompactMode.ts";

export const VISUALIZER_STYLES = ["off", "bars", "terrain", "sphere", "tunnel"] as const;
export const VISUALIZER_LABELS = ["Off", "Bars", "Terrain", "Sphere", "Tunnel"];
type Style = Exclude<(typeof VISUALIZER_STYLES)[number], "off">;

const CANVAS_CLASS = "SL_Visualizer";
/** Levels on each side of the middle. */
const HALF = 28;
/** Loudness (dB) relative to the song's average that maps to an empty and a full level. */
const QUIET_DB = -22;
const LOUD_DB = 5;
/** How fast levels rise to and fall back from their target, per second. */
const ATTACK = 26;
const RELEASE = 6.5;
/** How fast a beat's kick dies away, per second. */
const BEAT_DECAY = 7;

const heights = new Float32Array(HALF);
const targets = new Float32Array(HALF);
/** The song's loudness and the latest beat's kick, both 0 to 1 and smoothed. */
let level = 0;
let kick = 0;
let levelTarget = 0;
let kickTarget = 0;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let shown = false;
let settled = true;
let lastFrame = 0;
/** Seconds the visualizer has been moving, for spins and drifts that shouldn't follow seeks. */
let clock = 0;

let trackUri: string | undefined;
let analysis: AudioAnalysisData | null = null;
let segIndex = 0;
let beatIndex = 0;

function currentStyle(): Style | null {
  const value = $noLyricsVisualizer.get();
  return (VISUALIZER_STYLES as readonly string[]).includes(value) && value !== "off" ? (value as Style) : null;
}

function wanted(): boolean {
  return !!currentStyle() && !!PageContainer && !IsCardMode && !IsCompactMode() && IsShowingNoLyrics();
}

function mount(page: HTMLElement): void {
  const contentBox = page.querySelector<HTMLElement>(".ContentBox");
  if (!contentBox) return;
  if (canvas?.parentElement === contentBox) return;
  canvas?.remove();
  canvas = page.ownerDocument.createElement("canvas");
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute("aria-hidden", "true");
  ctx = canvas.getContext("2d");
  // Under the cover and song info, over the background.
  const nowBar = contentBox.querySelector(":scope > .NowBar");
  contentBox.insertBefore(canvas, nowBar);
  heights.fill(0);
  settled = false;
}

function loadAnalysis(uri: string | undefined): void {
  if (uri === trackUri) return;
  trackUri = uri;
  analysis = null;
  segIndex = 0;
  beatIndex = 0;
  if (!uri) return;
  void getDynamicAudioAnalysis(uri).then((data) => {
    if (trackUri === uri && data?.segments?.length) analysis = data;
  });
}

/** The item playing at `t`, found from the last one so a song playing on only steps forward. */
function find<T extends { start: number }>(items: T[], t: number, from: number): number {
  let i = Math.min(Math.max(from, 0), items.length - 1);
  if (items[i].start > t) {
    // A seek back: search from the start.
    let lo = 0;
    let hi = i;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (items[mid].start <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  while (i + 1 < items.length && items[i + 1].start <= t) i++;
  return i;
}

/** Loudness (dB) at `t`: up to the slice's peak, then down to where the next one starts. */
function loudnessAt(t: number, seg: Segment, next: Segment | undefined): number {
  const peakAt = seg.start + seg.loudness_max_time;
  if (t < peakAt) {
    const k = seg.loudness_max_time > 0 ? (t - seg.start) / seg.loudness_max_time : 1;
    return seg.loudness_start + (seg.loudness_max - seg.loudness_start) * Math.min(Math.max(k, 0), 1);
  }
  const end = next?.loudness_start ?? seg.loudness_end ?? seg.loudness_max;
  const span = seg.start + seg.duration - peakAt;
  const k = span > 0 ? (t - peakAt) / span : 1;
  return seg.loudness_max + (end - seg.loudness_max) * Math.min(Math.max(k, 0), 1);
}

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/** Sets where every level is heading at `t` seconds into the song. */
function targetsFromAnalysis(data: AudioAnalysisData, t: number): void {
  const segs = data.segments;
  segIndex = find(segs, t, segIndex);
  const seg = segs[segIndex];
  const next = segs[segIndex + 1];
  const loud = clamp01((loudnessAt(t, seg, next) - data.track.loudness - QUIET_DB) / (LOUD_DB - QUIET_DB));
  const shaped = loud ** 1.4;
  levelTarget = shaped;

  let beatKick = 0;
  const beats: Beat[] = data.beats;
  if (beats.length) {
    beatIndex = find(beats, t, beatIndex);
    const beat = beats[beatIndex];
    if (t >= beat.start) beatKick = Math.exp(-(t - beat.start) * BEAT_DECAY) * (0.5 + 0.5 * clamp01(beat.confidence));
  }
  kickTarget = beatKick * (0.4 + 0.6 * shaped);

  const pitches = seg.pitches ?? [];
  const timbre = seg.timbre ?? [];
  // The second timbre coefficient follows how bright the sound is; bright slices lift the outer levels.
  const bright = clamp01(((timbre[1] ?? 0) + 40) / 140);
  for (let j = 0; j < HALF; j++) {
    const out = j / (HALF - 1);
    // The 12 notes spread across the levels, blended between neighbours.
    const p = (j * 12) / HALF;
    const a = pitches[Math.floor(p) % 12] ?? 0.5;
    const b = pitches[(Math.floor(p) + 1) % 12] ?? 0.5;
    const note = a + (b - a) * (p - Math.floor(p));
    const tilt = 1 - out * (0.55 - 0.35 * bright);
    const grain = 1 + 0.14 * Math.tanh((timbre[2 + (j % 10)] ?? 0) / 50);
    const beatLift = beatKick * 0.28 * (1 - out) ** 2;
    targets[j] = clamp01(shaped * (0.3 + 0.7 * note) * tilt * grain + beatLift * shaped);
  }
}

function targetsFromWave(t: number): void {
  levelTarget = 0.35 + 0.1 * Math.sin(t * 0.8);
  kickTarget = 0;
  for (let j = 0; j < HALF; j++) {
    const out = j / (HALF - 1);
    const wave = 0.5 + 0.5 * Math.sin(t * 1.7 - j * 0.42) * Math.sin(t * 0.63 + j * 0.17);
    targets[j] = (0.08 + 0.22 * wave) * (1 - out * 0.5);
  }
}

/** The level for a position across the row, 0 in the middle to 1 at either end. */
function levelAcross(u: number): number {
  const x = Math.min(Math.abs(u), 1) * (HALF - 1);
  const i = Math.floor(x);
  const a = heights[i];
  const b = heights[Math.min(i + 1, HALF - 1)];
  return a + (b - a) * (x - i);
}

// ─── Cover position ──────────────────────────────────────────────────────────

let coverCache = { at: -Infinity, x: 0.5, y: 0.45, half: 0.18 };

/** The cover's centre and half its size, in canvas pixels, refreshed a few times a second. */
function coverIn(w: number, h: number, now: number): { x: number; y: number; half: number } {
  if (now - coverCache.at > 400 && canvas) {
    const cover = PageContainer?.querySelector<HTMLElement>(".ContentBox .NowBar .MediaImageContainer");
    const box = canvas.getBoundingClientRect();
    const rect = cover?.getBoundingClientRect();
    if (rect && rect.width > 0 && box.width > 0) {
      coverCache = {
        at: now,
        x: (rect.left + rect.width / 2 - box.left) / box.width,
        y: (rect.top + rect.height / 2 - box.top) / box.height,
        half: Math.max(rect.width, rect.height) / 2 / box.width,
      };
    } else {
      coverCache = { at: now, x: 0.5, y: 0.45, half: 0.18 };
    }
  }
  return { x: coverCache.x * w, y: coverCache.y * h, half: coverCache.half * w };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function drawBars(c: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
  // Low enough that the tallest bars stay under the song's title and artist.
  const area = h * 0.15;
  const slot = w / (HALF * 2);
  const bar = Math.max(2 * dpr, slot * 0.38);
  const floor = h - bar * 0.5;
  const gradient = c.createLinearGradient(0, h, 0, h - area);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.42)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0.1)");
  c.fillStyle = gradient;
  c.beginPath();
  const mid = w / 2;
  for (let j = 0; j < HALF; j++) {
    // A silent bar still shows as a dot, so the row stays visible between notes.
    const height = Math.max(bar, heights[j] * (area - bar));
    const top = floor - height + bar * 0.5;
    for (const x of [mid + j * slot + (slot - bar) / 2, mid - (j + 1) * slot + (slot - bar) / 2]) {
      c.roundRect(x, top, bar, height, bar / 2);
    }
  }
  c.fill();
}

const TERRAIN_ROWS = 34;
const TERRAIN_COLS = 48;
/** How often (s) a new ridge is laid down at the front. */
const TERRAIN_STEP = 0.07;
const terrainRows: Float32Array[] = Array.from({ length: TERRAIN_ROWS }, () => new Float32Array(TERRAIN_COLS + 1));
let terrainHead = 0;
let terrainPhase = 0;

/**
 * A ridge's height across the landscape, -1 (left) to 1 (right). The strongest levels go to
 * the sides and the middle stays low, so the ridges rise either side of a valley and the
 * song's title sits in the valley rather than behind a ridge.
 */
function ridgeAt(u: number): number {
  const side = Math.abs(u);
  return levelAcross(1 - side) * side ** 0.8;
}

function stepTerrain(dt: number): void {
  terrainPhase += dt / TERRAIN_STEP;
  while (terrainPhase >= 1) {
    terrainPhase -= 1;
    terrainHead = (terrainHead + 1) % TERRAIN_ROWS;
    const row = terrainRows[terrainHead];
    for (let c = 0; c <= TERRAIN_COLS; c++) row[c] = ridgeAt((c / TERRAIN_COLS) * 2 - 1);
  }
}

function drawTerrain(c: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
  // Below the song's title, so the far ridges meet under it and the near ones rise either side.
  const horizon = h * 0.87;
  const focal = w * 0.5;
  const camera = 0.3;
  const near = 1;
  const depth = 7;
  const span = 2.6;
  const lift = 2.4;
  // The newest ridge is live, so the front of the landscape moves with the song right away.
  const live = terrainRows[terrainHead];
  for (let col = 0; col <= TERRAIN_COLS; col++) live[col] = ridgeAt((col / TERRAIN_COLS) * 2 - 1);

  const fade = c.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, "rgba(255, 255, 255, 0)");
  fade.addColorStop(0.2, "rgba(255, 255, 255, 1)");
  fade.addColorStop(0.8, "rgba(255, 255, 255, 1)");
  fade.addColorStop(1, "rgba(255, 255, 255, 0)");
  c.strokeStyle = fade;
  c.lineJoin = "round";

  // Back to front, so nearer ridges are drawn last.
  for (let k = TERRAIN_ROWS - 1; k >= 0; k--) {
    const row = terrainRows[(terrainHead - k + TERRAIN_ROWS) % TERRAIN_ROWS];
    const z = near + ((k + (k === 0 ? 0 : terrainPhase)) / TERRAIN_ROWS) * depth;
    const away = (z - near) / depth;
    c.globalAlpha = (1 - away) ** 1.4 * 0.6;
    c.lineWidth = Math.max(1, (1.8 * dpr) / z);
    c.beginPath();
    for (let col = 0; col <= TERRAIN_COLS; col++) {
      const x = ((col / TERRAIN_COLS) * 2 - 1) * span;
      const sx = w / 2 + (x / z) * focal;
      const sy = horizon + ((camera - row[col] * lift) / z) * focal;
      if (col === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}

const SPHERE_POINTS = 1100;
const sphere = (() => {
  // Points spread evenly over a sphere, each with the level it follows (by height on the globe).
  const points = new Float32Array(SPHERE_POINTS * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < SPHERE_POINTS; i++) {
    const y = 1 - ((i + 0.5) / SPHERE_POINTS) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    points.set([Math.cos(a) * r, y, Math.sin(a) * r, Math.abs(y)], i * 4);
  }
  return points;
})();
let sphereSpin = 0;

function drawSphere(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, now: number): void {
  const cover = coverIn(w, h, now);
  // Big enough that the globe shows all round the cover, which hides its middle.
  const radius = cover.half * 1.3 * (1 + 0.1 * level + 0.08 * kick);
  const tilt = 0.4 + 0.12 * Math.sin(clock * 0.21);
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const cosS = Math.cos(sphereSpin);
  const sinS = Math.sin(sphereSpin);
  const distance = 3.2;
  c.fillStyle = "#fff";
  for (let i = 0; i < SPHERE_POINTS; i++) {
    const o = i * 4;
    const push = 1 + 0.22 * levelAcross(sphere[o + 3]);
    let x = sphere[o] * push;
    let y = sphere[o + 1] * push;
    let z = sphere[o + 2] * push;
    // Spin round the upright axis, then lean towards the viewer.
    [x, z] = [x * cosS - z * sinS, x * sinS + z * cosS];
    [y, z] = [y * cosT - z * sinT, y * sinT + z * cosT];
    const scale = distance / (distance + z);
    const front = (1 - z / 1.4) / 2;
    c.globalAlpha = clamp01(0.2 + 0.7 * front) * (0.6 + 0.4 * level);
    const size = (1.4 + 2 * front) * dpr * scale;
    c.fillRect(cover.x + x * radius * scale - size / 2, cover.y + y * radius * scale - size / 2, size, size);
  }
  c.globalAlpha = 1;
}

const TUNNEL_SIDES = 72;
const TUNNEL_FAR = 2.6;
const TUNNEL_NEAR = 0.22;
/** How often (s) a new ring sets off. */
const TUNNEL_STEP = 0.08;
interface Ring {
  z: number;
  turn: number;
  shape: Float32Array;
  punch: number;
}
const rings: Ring[] = [];
let tunnelPhase = 0;

function stepTunnel(dt: number, playing: boolean): void {
  const speed = 0.6 + 1.2 * level + 1.4 * kick;
  for (const ring of rings) ring.z -= speed * dt;
  while (rings.length && rings[0].z < TUNNEL_NEAR) rings.shift();
  if (!playing) return;
  tunnelPhase += dt / TUNNEL_STEP;
  while (tunnelPhase >= 1) {
    tunnelPhase -= 1;
    const shape = new Float32Array(HALF);
    shape.set(heights);
    rings.push({ z: TUNNEL_FAR, turn: clock * 0.35, shape, punch: kick });
  }
}

function drawTunnel(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, now: number): void {
  const cover = coverIn(w, h, now);
  // A ring at depth 1 sits just outside the cover's edges.
  const focal = cover.half * 1.05;
  c.strokeStyle = "#fff";
  c.lineJoin = "round";
  for (const ring of rings) {
    const z = ring.z;
    // Fades in from the distance and out as it passes the viewer.
    const life = clamp01((TUNNEL_FAR - z) / 0.8) * clamp01((z - TUNNEL_NEAR) / 0.35);
    c.globalAlpha = life * Math.min(0.65, 0.22 + 0.4 * ring.punch + 0.25 * level);
    c.lineWidth = Math.max(1, (1.4 + 2 * ring.punch) * dpr * Math.min(1.6, 1 / z));
    c.beginPath();
    for (let s = 0; s <= TUNNEL_SIDES; s++) {
      const angle = (s / TUNNEL_SIDES) * Math.PI * 2 + ring.turn;
      // Mirrored left to right, so the ring is the bar row bent round.
      const u = Math.abs((s / TUNNEL_SIDES) * 2 - 1);
      const x = u * (HALF - 1);
      const i = Math.floor(x);
      const v = ring.shape[i] + (ring.shape[Math.min(i + 1, HALF - 1)] - ring.shape[i]) * (x - i);
      const r = ((1 + 0.5 * v) / z) * focal;
      const sx = cover.x + Math.cos(angle) * r;
      const sy = cover.y + Math.sin(angle) * r;
      if (s === 0) c.moveTo(sx, sy);
      else c.lineTo(sx, sy);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}

// ─── Frame ───────────────────────────────────────────────────────────────────

function draw(style: Style, now: number): void {
  if (!canvas || !ctx) return;
  const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (w === 0 || h === 0) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.clearRect(0, 0, w, h);
  if (style === "bars") drawBars(ctx, w, h, dpr);
  else if (style === "terrain") drawTerrain(ctx, w, h, dpr);
  else if (style === "sphere") drawSphere(ctx, w, h, dpr, now);
  else drawTunnel(ctx, w, h, dpr, now);
}

onAnimationFrame((timestamp) => {
  const want = wanted();
  const style = currentStyle();
  if (want !== shown) {
    shown = want;
    if (want && PageContainer) mount(PageContainer);
    canvas?.classList.toggle("Visible", want);
  } else if (want && PageContainer && !canvas?.isConnected) {
    // The page was rebuilt (fullscreen, popup) since the visualizer was added.
    mount(PageContainer);
    canvas?.classList.add("Visible");
  }
  if (!canvas?.isConnected) return;
  if (style && canvas.dataset.style !== style) {
    canvas.dataset.style = style;
    settled = false;
  }

  const dt = Math.min((timestamp - lastFrame) / 1000, 0.1);
  lastFrame = timestamp;
  const playing = shown && SpotifyPlayer.IsPlaying;
  if (!playing && settled) return;

  if (playing) {
    loadAnalysis(SpotifyPlayer.GetUri());
    const t = SpotifyPlayer.GetPosition() / 1000;
    if (analysis) targetsFromAnalysis(analysis, t);
    else targetsFromWave(t);
  } else {
    targets.fill(0);
    levelTarget = 0;
    kickTarget = 0;
  }

  const rise = 1 - Math.exp(-ATTACK * dt);
  const fall = 1 - Math.exp(-RELEASE * dt);
  let moving = false;
  for (let j = 0; j < HALF; j++) {
    const d = targets[j] - heights[j];
    heights[j] += d * (d > 0 ? rise : fall);
    if (Math.abs(d) > 0.002) moving = true;
  }
  level += (levelTarget - level) * (levelTarget > level ? rise : fall);
  kick += (kickTarget - kick) * (kickTarget > kick ? rise : fall);

  // The 3D styles keep drifting while the song plays; paused, they come to rest.
  const motion = playing ? 1 : Math.max(level, 0.02);
  clock += dt * motion;
  sphereSpin += dt * (0.18 + 0.7 * level + 0.6 * kick) * motion;
  if (style === "terrain") stepTerrain(dt * motion);
  if (style === "tunnel") stepTunnel(dt, playing);
  else rings.length = 0;

  settled = !playing && !moving && rings.length === 0;
  if (style) draw(style, timestamp);
});

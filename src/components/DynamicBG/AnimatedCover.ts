// Animated covers: an album's Apple Music animated cover plays inside the cover square.
// Spotify can't read music.apple.com (no CORS) or decode Apple's H.264/HEVC video, so
// ruytha.dev/api/motion-cover finds the cover and serves it as VP8 WebM (the site's
// api/motion-cover.js). The album is matched by its barcode (from Spotify's album
// metadata), falling back to its name. A quick check runs first, so only albums that
// have a cover show the loading shimmer while it converts. Albums without one keep the
// still cover. Canvas Stage, when it shows, already fills the cover's side, so this waits.
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { $animatedCovers, $backgroundStyle, $coverMotionBackground } from "../../utils/stores.ts";
import Logger from "../../utils/Logger.ts";
import Global from "../Global/Global.ts";
import { SpotifyFetch } from "../Global/SpotifyFetch.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { PageContainer } from "../Pages/PageView.ts";
import { AMLLBackgroundMap } from "./AMLLBackground.ts";
import { getBackgroundStyle, PAGE_BACKGROUND_KEY, SetKawarpSuspended } from "./dynamicBackground.ts";

const coverLogger = new Logger("Animated Cover");

const MOTION_API = "https://ruytha.dev/api/motion-cover";
// The first request for an album converts it, which takes several seconds.
const FETCH_TIMEOUT_MS = 60_000;

const VIDEO_CLASS = "SL_AnimatedCover";
const LOADING_CLASS = "SL_CoverLoading";
// The moving background (Background Follows the Cover): the cover's frames drawn into a
// tiny canvas and blurred there, scaled up by CSS, like Canvas Stage's backdrop.
const AMBIENT_CLASS = "SL_CoverAmbient";
const AMBIENT_PAGE_CLASS = "SL_MotionBackground";
const AMBIENT_SIZE = 64;
const AMBIENT_INTERVAL_MS = 1000 / 30;
const AMBIENT_FILTER = "blur(4px) saturate(1.9) brightness(0.62)";
const STAGE_CLASS = "CanvasImmersive";

let video: HTMLVideoElement | null = null;
let albumKey: string | null = null;
// Per album: a blob URL of the cover's video, or null when it has none. Kept for the session.
const motionCache = new Map<string, Promise<string | null>>();
const upcCache = new Map<string, Promise<string | null>>();
let country: Promise<string> | null = null;
let generation = 0;
let pageObserver: MutationObserver | null = null;
let observedPage: HTMLElement | null = null;
let ambient: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
let ambientShowing = false;
let lastAmbientDraw = 0;
let ambientPrimed = false;

function coverContainer(): HTMLElement | null {
  return PageContainer?.querySelector<HTMLElement>(".ContentBox .NowBar .Header .MediaBox .MediaImageContainer") ?? null;
}

function stageShowing(): boolean {
  return !!PageContainer?.classList.contains(STAGE_CLASS);
}

type Album = { key: string; uri?: string; artist: string; name: string };

function playingAlbum(): Album | null {
  const item = Spicetify?.Player?.data?.item as
    | { type?: string; album?: { name?: string; uri?: string }; artists?: { name?: string }[]; metadata?: Record<string, string> }
    | undefined;
  if (!item || (item.type && item.type !== "track")) return null;
  const name = item.album?.name ?? item.metadata?.album_title;
  const artist = item.artists?.[0]?.name ?? item.metadata?.artist_name;
  if (!name || !artist) return null;
  return { key: item.album?.uri ?? `${artist} — ${name}`, uri: item.album?.uri, artist, name };
}

/** The album's barcode, from Spotify's own album metadata. Null when it has none. */
function albumUpc(uri: string | undefined): Promise<string | null> {
  if (!uri?.startsWith("spotify:album:")) return Promise.resolve(null);
  const cached = upcCache.get(uri);
  if (cached) return cached;
  const request = (async () => {
    const hex = Spicetify.URI.idToHex(uri.split(":")[2]);
    const res = await SpotifyFetch(`https://spclient.wg.spotify.com/metadata/4/album/${hex}?market=from_token`);
    if (!res.ok) return null;
    const data = (await res.json()) as { external_id?: { type?: string; id?: string }[] };
    return data.external_id?.find((e) => e.type === "upc")?.id ?? null;
  })().catch(() => null);
  upcCache.set(uri, request);
  return request;
}

/** The listener's store country, so Apple's matching store is tried first. */
function listenerCountry(): Promise<string> {
  country ??= (async () => {
    const values = await (Spicetify.Platform as any)?.ProductStateAPI?.getValues?.();
    const code = String(values?.country ?? "us").toLowerCase();
    return /^[a-z]{2}$/.test(code) ? code : "us";
  })().catch(() => "us");
  return country;
}

async function motionUrl(album: Album, check: boolean): Promise<string> {
  const params = new URLSearchParams({ artist: album.artist, album: album.name, country: await listenerCountry() });
  const upc = await albumUpc(album.uri);
  if (upc) params.set("upc", upc);
  if (check) params.set("check", "1");
  return `${MOTION_API}?${params}`;
}

/**
 * The album's cover as a blob URL, or null. `onConverting` runs once it's known the album
 * has one, before the (possibly slow) download.
 */
function loadMotion(album: Album, onConverting: () => void): Promise<string | null> {
  const cached = motionCache.get(album.key);
  if (cached) return cached;
  const request = (async () => {
    const checked = await fetch(await motionUrl(album, true), { signal: AbortSignal.timeout(15_000) });
    if (!checked.ok) throw new Error(`Check HTTP ${checked.status}`);
    if (!((await checked.json()) as { found?: boolean }).found) return null;
    onConverting();
    const res = await fetch(await motionUrl(album, false), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return URL.createObjectURL(await res.blob());
  })().catch((err) => {
    // A failure isn't remembered, so the next play of the album tries again.
    coverLogger.warn("Animated cover failed", album.artist, album.name, err);
    motionCache.delete(album.key);
    return null;
  });
  motionCache.set(album.key, request);
  return request;
}

// Per album: whether it has an animated cover, from the quick check alone. Kept for the session.
const hasCoverCache = new Map<string, Promise<boolean>>();

/**
 * Whether the playing album has an animated cover the cover square would play, so Canvas
 * Stage can step aside for it (Prefer the Animated Cover). Only the quick check, never
 * the conversion; false when animated covers are off or the check fails.
 */
export function PlayingAlbumHasAnimatedCover(): Promise<boolean> {
  const album = $animatedCovers.get() ? playingAlbum() : null;
  if (!album) return Promise.resolve(false);
  const cached = hasCoverCache.get(album.key);
  if (cached) return cached;
  const request = (async () => {
    const res = await fetch(await motionUrl(album, true), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Check HTTP ${res.status}`);
    return !!((await res.json()) as { found?: boolean }).found;
  })().catch((err) => {
    // Not remembered, so the next play of the album checks again; the Canvas shows meanwhile.
    coverLogger.warn("Animated cover check failed", album.artist, album.name, err);
    hasCoverCache.delete(album.key);
    return false;
  });
  hasCoverCache.set(album.key, request);
  return request;
}

function release() {
  albumKey = null;
  if (video) {
    video.pause();
    video.remove();
  }
  video = null;
  syncAmbient();
}

/** Shows the moving background while a cover plays and the setting is on, and the page's own background rests under it. */
function syncAmbient() {
  const page = PageContainer;
  const show =
    !!page &&
    !!video?.classList.contains("Visible") &&
    $coverMotionBackground.get() &&
    getBackgroundStyle() !== "none";
  page?.classList.toggle(AMBIENT_PAGE_CLASS, show);
  if (show && page) {
    const contentBox = page.querySelector<HTMLElement>(".ContentBox");
    if (contentBox && ambient?.canvas.parentElement !== contentBox) {
      const canvas = document.createElement("canvas");
      canvas.className = AMBIENT_CLASS;
      canvas.width = AMBIENT_SIZE;
      canvas.height = AMBIENT_SIZE;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.filter = AMBIENT_FILTER;
        contentBox.prepend(canvas);
        ambient = { canvas, ctx };
        ambientPrimed = false;
      }
    }
  }
  if (show === ambientShowing) return;
  ambientShowing = show;
  SetKawarpSuspended(PAGE_BACKGROUND_KEY, show);
  const amll = AMLLBackgroundMap.get(PAGE_BACKGROUND_KEY);
  if (show) amll?.pause();
  else if (!page?.ownerDocument.hidden) amll?.resume();
}

function syncPlayback() {
  if (!video) return;
  // The video's own document: the popup's when Popup Lyrics is open, which stays on screen
  // while Spotify's main window is minimised.
  if (SpotifyPlayer.IsPlaying && !video.ownerDocument.hidden && !stageShowing()) {
    video.play().catch(() => undefined);
  } else {
    video.pause();
  }
}

function watchPage() {
  if (observedPage === PageContainer) return;
  pageObserver?.disconnect();
  observedPage = PageContainer ?? null;
  if (!observedPage) return;
  // Canvas Stage coming or going flips this class; the cover video yields to it.
  let staged = stageShowing();
  pageObserver = new MutationObserver(() => {
    if (stageShowing() === staged) return;
    staged = stageShowing();
    void Refresh();
  });
  pageObserver.observe(observedPage, { attributes: true, attributeFilter: ["class"] });
}

async function Refresh() {
  const gen = ++generation;
  watchPage();
  const container = coverContainer();
  const album = $animatedCovers.get() && container && !stageShowing() ? playingAlbum() : null;
  if (!album || !container) {
    if (video) {
      video.classList.remove("Visible");
      const leaving = video;
      setTimeout(() => {
        if (gen === generation && video === leaving) release();
      }, 600);
    }
    return;
  }

  // Same album, still in place (the NowBar can be rebuilt under it).
  if (video && albumKey === album.key && video.parentElement === container) {
    video.classList.add("Visible");
    syncPlayback();
    return;
  }

  container.classList.remove(LOADING_CLASS);
  const src = await loadMotion(album, () => {
    if (gen === generation) container.classList.add(LOADING_CLASS);
  });
  if (gen !== generation) return;
  container.classList.remove(LOADING_CLASS);
  release();
  if (!src) return;

  const el = document.createElement("video");
  el.className = VIDEO_CLASS;
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.disablePictureInPicture = true;
  el.setAttribute("aria-hidden", "true");
  el.addEventListener(
    "loadeddata",
    () => {
      el.classList.add("Visible");
      syncAmbient();
    },
    { once: true }
  );
  el.src = src;
  container.append(el);
  video = el;
  albumKey = album.key;
  syncPlayback();
}

const refreshSoon = () => setTimeout(() => void Refresh(), 0);

Global.Event.listen("page:open", refreshSoon);
Global.Event.listen("page:destroy", () => {
  generation++;
  ambient = null;
  release();
  pageObserver?.disconnect();
  pageObserver = null;
  observedPage = null;
});
Global.Event.listen("playback:songchange", refreshSoon);
Global.Event.listen("playback:playpause", syncPlayback);
Global.Event.listen("fullscreen:open", refreshSoon);
Global.Event.listen("fullscreen:exit", refreshSoon);
Global.Event.listen("nowbar:open", refreshSoon);
Global.Event.listen("compact-mode:enable", refreshSoon);
Global.Event.listen("compact-mode:disable", refreshSoon);
$animatedCovers.listen(refreshSoon);
$coverMotionBackground.listen(() => syncAmbient());
$backgroundStyle.listen(() => setTimeout(syncAmbient, 0));

onAnimationFrame((timestamp) => {
  if (!ambientShowing || !ambient || !video) return;
  if (timestamp - lastAmbientDraw < AMBIENT_INTERVAL_MS) return;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  lastAmbientDraw = timestamp;
  const { ctx } = ambient;
  // Drawn a little larger than the canvas, so the blur has no dark rim at the edges.
  const pad = AMBIENT_SIZE * 0.15;
  // Blending into the previous frame keeps the glow from flickering on fast cuts.
  ctx.globalAlpha = ambientPrimed ? 0.35 : 1;
  ctx.drawImage(video, -pad, -pad, AMBIENT_SIZE + pad * 2, AMBIENT_SIZE + pad * 2);
  ambientPrimed = true;
});
document.addEventListener("visibilitychange", syncPlayback);

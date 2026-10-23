// Animated covers: an album's Apple Music animated cover plays inside the cover square.
// Spotify can't read music.apple.com (no CORS) or decode Apple's H.264/HEVC video, so
// ruytha.dev/api/motion-cover finds the cover and serves it as VP8 WebM (the site's
// api/motion-cover.js). Albums without one keep the still cover. Canvas Stage, when it
// shows, already fills the cover's side, so this waits for it to go.
import { $animatedCovers } from "../../utils/stores.ts";
import Logger from "../../utils/Logger.ts";
import Global from "../Global/Global.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { PageContainer } from "../Pages/PageView.ts";

const coverLogger = new Logger("Animated Cover");

const MOTION_API = "https://ruytha.dev/api/motion-cover";
// The first request for an album converts it, which takes several seconds.
const FETCH_TIMEOUT_MS = 60_000;

const VIDEO_CLASS = "SL_AnimatedCover";
const STAGE_CLASS = "CanvasImmersive";

let video: HTMLVideoElement | null = null;
let albumKey: string | null = null;
// Per album: a blob URL of the cover's video, or null when it has none. Kept for the session.
const motionCache = new Map<string, Promise<string | null>>();
let generation = 0;
let pageObserver: MutationObserver | null = null;
let observedPage: HTMLElement | null = null;

function coverContainer(): HTMLElement | null {
  return PageContainer?.querySelector<HTMLElement>(".ContentBox .NowBar .Header .MediaBox .MediaImageContainer") ?? null;
}

function stageShowing(): boolean {
  return !!PageContainer?.classList.contains(STAGE_CLASS);
}

type Album = { key: string; artist: string; name: string };

function playingAlbum(): Album | null {
  const item = Spicetify?.Player?.data?.item as
    | { type?: string; album?: { name?: string }; artists?: { name?: string }[]; metadata?: Record<string, string> }
    | undefined;
  if (!item || (item.type && item.type !== "track")) return null;
  const name = item.album?.name ?? item.metadata?.album_title;
  const artist = item.artists?.[0]?.name ?? item.metadata?.artist_name;
  if (!name || !artist) return null;
  return { key: `${artist} — ${name}`, artist, name };
}

function loadMotion(album: Album): Promise<string | null> {
  const cached = motionCache.get(album.key);
  if (cached) return cached;
  const url = `${MOTION_API}?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.name)}`;
  const request = (async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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

function release() {
  albumKey = null;
  if (video) {
    video.pause();
    video.remove();
  }
  video = null;
}

function syncPlayback() {
  if (!video) return;
  if (SpotifyPlayer.IsPlaying && !document.hidden && !stageShowing()) {
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

  const src = await loadMotion(album);
  if (gen !== generation) return;
  release();
  if (!src) return;

  const el = document.createElement("video");
  el.className = VIDEO_CLASS;
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.disablePictureInPicture = true;
  el.setAttribute("aria-hidden", "true");
  el.addEventListener("loadeddata", () => el.classList.add("Visible"), { once: true });
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
document.addEventListener("visibilitychange", syncPlayback);

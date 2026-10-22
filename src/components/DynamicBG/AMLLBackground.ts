import { BackgroundRender, MeshGradientRenderer } from "@applemusic-like-lyrics/core";
import {
  $amllBgFlowSpeed,
  $amllBgStaticMode,
  $animationFpsCap,
  $animationFpsCapEnabled,
} from "../../utils/stores.ts";
import Logger from "../../utils/Logger.ts";

const amllBgLogger = new Logger("AMLL Background");

export type AMLLBackgroundInstance = BackgroundRender<MeshGradientRenderer>;

/** Fraction of the canvas' physical pixels the mesh is rendered at. */
const AMLL_RENDER_SCALE = 0.5;
/** Frame rate when Limit Frame Rate is off. */
const AMLL_DEFAULT_FPS = 60;
/** Ceiling while Spotify is paused: the mesh barely moves then, so don't spend GPU on it. */
const AMLL_PAUSED_FPS = 15;

/** Live instances by background key. Only these get speed, FPS and settings updates. */
export const AMLLBackgroundMap = new Map<string, AMLLBackgroundInstance>();

let amllInitFailed = false;
let animationSpeed = 1;
let playbackPaused = false;

/** False once WebGL init has failed, so callers use Kawarp instead of retrying on every song. */
export function IsAMLLBackgroundAvailable(): boolean {
  return !amllInitFailed;
}

function targetFPS(): number {
  const fps = $animationFpsCapEnabled.get() ? $animationFpsCap.get() : AMLL_DEFAULT_FPS;
  return playbackPaused ? Math.min(fps, AMLL_PAUSED_FPS) : fps;
}

function applySettings(instance: AMLLBackgroundInstance) {
  instance.setFlowSpeed($amllBgFlowSpeed.get() * animationSpeed);
  instance.setFPS(targetFPS());
  instance.setStaticMode($amllBgStaticMode.get());
}

/**
 * A new, unmounted instance, or null when WebGL isn't available. A failure is
 * remembered so every later apply goes straight to Kawarp.
 */
export function CreateAMLLBackground(): AMLLBackgroundInstance | null {
  if (amllInitFailed) return null;
  let instance: AMLLBackgroundInstance;
  try {
    if (!MeshGradientRenderer.isSupported()) {
      throw new Error("WebGL is not supported in this environment");
    }
    instance = BackgroundRender.new(MeshGradientRenderer);
  } catch (err) {
    amllInitFailed = true;
    amllBgLogger.warn("AMLL background failed to initialize; using Dynamic (Kawarp) instead", err);
    return null;
  }

  const canvas = instance.getElement();
  // BackgroundRender pins z-index: -1, which would put it behind the page's own background.
  canvas.style.zIndex = "";
  instance.setRenderScale(AMLL_RENDER_SCALE);
  applySettings(instance);
  if (document.hidden) instance.pause();
  return instance;
}

/**
 * Load a cover into `instance`. `source` is a fetchable URL, or a Blob for art that
 * can't be fetched (local files). Resolves false if the image couldn't be used.
 */
export async function LoadAMLLCover(
  instance: AMLLBackgroundInstance,
  source: string | Blob
): Promise<boolean> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    await instance.setAlbum(url);
    return true;
  } catch (err) {
    amllBgLogger.warn("Cover couldn't be loaded into the AMLL background", err);
    return false;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

/**
 * Stop updating the instance behind `canvas` and drop it from the map. It keeps its
 * last frame until DisposeAMLLInstance, so a retired layer can still fade out.
 */
export function ReleaseAMLLCanvas(canvas: Element): AMLLBackgroundInstance | undefined {
  for (const [key, instance] of AMLLBackgroundMap) {
    if (instance.getElement() !== canvas) continue;
    AMLLBackgroundMap.delete(key);
    instance.pause();
    return instance;
  }
  return undefined;
}

export function DisposeAMLLInstance(instance: AMLLBackgroundInstance) {
  // dispose() frees AMLL's GL resources but leaves the context alive. Release it too,
  // or reopening the page keeps adding WebGL contexts until the browser drops old ones.
  const gl = instance.getElement().getContext("webgl");
  instance.dispose();
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
}

export function DisposeAMLLBackground(key: string) {
  const instance = AMLLBackgroundMap.get(key);
  if (!instance) return;
  AMLLBackgroundMap.delete(key);
  DisposeAMLLInstance(instance);
}

/** Follows the same music-driven speed as Kawarp (slow drift while paused). */
export function SetAMLLAnimationSpeed(speed: number) {
  animationSpeed = speed;
  const flowSpeed = $amllBgFlowSpeed.get() * speed;
  AMLLBackgroundMap.forEach((instance) => instance.setFlowSpeed(flowSpeed));
}

export function SetAMLLPlaybackPaused(isPaused: boolean) {
  playbackPaused = isPaused;
  const fps = targetFPS();
  AMLLBackgroundMap.forEach((instance) => instance.setFPS(fps));
}

const applySettingsToAll = () => AMLLBackgroundMap.forEach(applySettings);
$amllBgFlowSpeed.listen(applySettingsToAll);
$amllBgStaticMode.listen(applySettingsToAll);
$animationFpsCap.listen(applySettingsToAll);
$animationFpsCapEnabled.listen(applySettingsToAll);

// AMLL runs its own frame loop, so stop it outright while Spotify is hidden.
document.addEventListener("visibilitychange", () => {
  AMLLBackgroundMap.forEach((instance) => {
    if (document.hidden) {
      instance.pause();
    } else {
      instance.resume();
    }
  });
});

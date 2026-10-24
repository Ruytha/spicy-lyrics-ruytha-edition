import { atom } from "nanostores";
import { ProjectVersion } from "../../project/config.ts";

export const SETTINGS_KEY = "SL:settings";

function readSettingsBlob(): Record<string, any> {
  const raw = Spicetify.LocalStorage.get(SETTINGS_KEY);
  if (raw === null || raw === undefined) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSettingsBlob(obj: Record<string, any>) {
  Spicetify.LocalStorage.set(SETTINGS_KEY, JSON.stringify(obj));
}

function migrateSettingsKeys(blob: Record<string, any>): Record<string, any> {
  const renames: Record<string, string> = {
    "skip-spicy-font": "skipSpicyFont",
    show_npv_dynamic_bg: "showNpvDynamicBg",
    // Was an experiment; carry over the choice of anyone who toggled it.
    "experiment:duetLinePadding": "duetLinePadding",
    staticBackgroundBlur: "backgroundBlur",
  };
  let changed = false;
  for (const [oldKey, newKey] of Object.entries(renames)) {
    if (oldKey in blob) {
      blob[newKey] = blob[oldKey];
      delete blob[oldKey];
      changed = true;
    }
  }
  // The old "Static Background" select. Its "auto" did exactly what "artistHeader" did.
  if ("staticBackgroundMode" in blob) {
    const styles: Record<string, BackgroundStyle> = {
      off: "dynamic",
      auto: "artist",
      artistHeader: "artist",
      coverArt: "cover",
      color: "color",
    };
    blob.backgroundStyle ??= styles[blob.staticBackgroundMode] ?? "dynamic";
    delete blob.staticBackgroundMode;
    changed = true;
  }
  // Simple Lyrics Mode lost its "Animate" style; everyone gets the one that was the default.
  if ("simpleLyricsModeRenderingType" in blob) {
    delete blob.simpleLyricsModeRenderingType;
    changed = true;
  }
  if (changed) saveSettingsBlob(blob);
  return blob;
}

const _settings: Record<string, any> = migrateSettingsKeys(readSettingsBlob());

/**
 * An atom backed by the settings blob. Exported so feature modules (e.g.
 * `experiments.ts`) can register their own persisted settings without having to
 * add a line here for every one.
 */
export function persistAtom<T>(key: string, defaultValue: T) {
  const store = atom<T>(_settings[key] !== undefined ? _settings[key] : defaultValue);
  store.listen((v) => {
    _settings[key] = v;
    saveSettingsBlob(_settings);
  });
  persistedSettings.set(key, { reset: () => store.set(defaultValue) });
  return store;
}

// Every persisted setting by key, so a settings tab can put its rows back to their defaults.
const persistedSettings = new Map<string, { reset: () => void }>();

/** Put one setting back to its default. False when no persisted setting has that key. */
export function ResetSetting(key: string): boolean {
  const entry = persistedSettings.get(key);
  entry?.reset();
  return !!entry;
}

/** The saved settings as JSON, for a backup file. */
export function ExportSettings(): string {
  return JSON.stringify({ format: "spicy-lyrics-ruytha-settings", version: 1, settings: _settings }, null, 2);
}

/**
 * Replace the saved settings with a backup's. Settings are read once at startup, so the
 * caller reloads Spotify after. Throws on a file that isn't a settings backup.
 */
export function ImportSettings(json: string): void {
  const parsed = JSON.parse(json);
  const settings = parsed?.format === "spicy-lyrics-ruytha-settings" ? parsed.settings : null;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("That file isn't a Ruytha Edition settings backup.");
  }
  saveSettingsBlob(settings);
}

// Setting atoms (persisted)
// "none" paints nothing, so a theme's own background (an image, say) shows through.
export type BackgroundStyle = "dynamic" | "amll" | "starry" | "artist" | "cover" | "color" | "none";
export const BACKGROUND_STYLES: readonly BackgroundStyle[] = ["dynamic", "amll", "starry", "artist", "cover", "color", "none"];
export const $backgroundStyle = persistAtom<BackgroundStyle>("backgroundStyle", "dynamic");
// AMLL style: flow speed multiplier, and whether it holds still once each cover is in.
export const $amllBgFlowSpeed = persistAtom<number>("amllBgFlowSpeed", 1);
export const $amllBgStaticMode = persistAtom<boolean>("amllBgStaticMode", false);
// The lyrics page background swells on each beat (from Spotify's audio analysis).
export const $backgroundBeatPulse = persistAtom<boolean>("backgroundBeatPulse", true);
export type BeatPulseStrength = "subtle" | "normal" | "strong";
export const $beatPulseStrength = persistAtom<BeatPulseStrength>("beatPulseStrength", "normal");
// Blur radius (px) for the two image styles, "artist" and "cover".
export const $backgroundBlur = persistAtom<number>("backgroundBlur", 0);
// Who draws synced lyrics: "spicy" (the built-in renderer) or "amll" (the AMLL player).
// Unsynced lyrics always use the built-in one.
export const $lyricsRenderer = persistAtom<string>("lyricsRenderer", "spicy");
// AMLL lyrics: the player's own effects, and where the playing line sits ("upper" is
// AMLL's default, a third of the way down; "center" is the middle).
export const $amllLyricsBlur = persistAtom<boolean>("amllLyricsBlur", true);
export const $amllLyricsSpring = persistAtom<boolean>("amllLyricsSpring", true);
export const $amllLyricsScale = persistAtom<boolean>("amllLyricsScale", true);
export const $amllLyricsPosition = persistAtom<"upper" | "center">("amllLyricsPosition", "upper");
export const $amllHidePassedLines = persistAtom<boolean>("amllHidePassedLines", false);
// For syncers: a readout of the playback time and the playing line's and word's timings.
export const $timingOverlay = persistAtom<boolean>("timingOverlay", false);
// Songs synced by Ruytha (the fork's maker) get shooting stars, a banner and a credit ring.
export const $ruythaSpotlight = persistAtom<boolean>("ruythaSpotlight", true);
// Background render controls, applied on top of whichever style is picked. Percentages:
// 100 is the style as designed. Bloom adds a glow on the bright parts (0 is off).
export const $bgBrightness = persistAtom<number>("bgBrightness", 100);
export const $bgSaturation = persistAtom<number>("bgSaturation", 100);
export const $bgContrast = persistAtom<number>("bgContrast", 100);
export const $bgBloom = persistAtom<number>("bgBloom", 0);
// Fraction of the screen's pixels the AMLL mesh renders at.
export type RenderQuality = "low" | "medium" | "high";
export const $bgRenderQuality = persistAtom<RenderQuality>("bgRenderQuality", "medium");
// Glow on sung words, as a percentage of the renderer's own (100 is unchanged).
export const $lyricGlow = persistAtom<number>("lyricGlow", 100);
// The cover: the song's Canvas plays inside it when it has one, it can pulse with the
// beat, melt into the background, or take the whole page with the lyrics hidden.
export const $animatedCovers = persistAtom<boolean>("animatedCovers", true);
// While an Apple Music animated cover plays, the page background is drawn from it.
export const $coverMotionBackground = persistAtom<boolean>("coverMotionBackground", true);
export const $coverBeatPulse = persistAtom<boolean>("coverBeatPulse", false);
export const $coverBlend = persistAtom<boolean>("coverBlend", false);
export const $coverOnlyMode = persistAtom<boolean>("coverOnlyMode", false);
export const $simpleLyricsMode = persistAtom<boolean>("simpleLyricsMode", false);
export const $minimalLyricsMode = persistAtom<boolean>("minimalLyricsMode", false);
// Shows a word sung in syllables as one word when its parts line up evenly.
export const $joinSplitWords = persistAtom<boolean>("joinSplitWords", false);
// Tinted box drawn behind a lyrics line while the pointer is over it.
export const $lineHoverBackground = persistAtom<boolean>("lineHoverBackground", true);
// Wide inset on the side a duet line leans away from, so the two voices read as
// separate columns. Off gives duet lines the same slight padding as every line.
export const $duetLinePadding = persistAtom<boolean>("duetLinePadding", true);
// When a song ends on a duet line sung from the right, the credits under it
// (writers, provider, community info) move to the right with it.
export const $creditsFollowLastLine = persistAtom<boolean>("creditsFollowLastLine", false);
export const $skipSpicyFont = persistAtom<boolean>("skipSpicyFont", false);
// The page's font. Starts from the old Use System Font switch so nobody's font changes.
export type LyricsFont = "spicy" | "system" | "sf" | "geist" | "inter" | "bricolage" | "poppins" | "custom" | "file";
export const $lyricsFont = persistAtom<LyricsFont>("lyricsFont", $skipSpicyFont.get() ? "system" : "spicy");
// Any Google Fonts family name, used when the font is "custom".
export const $customFontName = persistAtom<string>("customFontName", "");
// The name of the font file picked for "file" (the file itself is in IndexedDB), and a
// count that goes up with each new pick, so the page re-registers it.
export const $fontFileName = persistAtom<string>("fontFileName", "");
export const $fontFileVersion = atom<number>(0);
export const $showNpvDynamicBg = persistAtom<boolean>("showNpvDynamicBg", true);
// Never inject the lyrics card into the Now Playing sidebar at all.
export const $disableNpvLyrics = persistAtom<boolean>("disableNpvLyrics", false);
// Pull the whole NPV lyrics card out of the sidebar while the current track has
// no lyrics, instead of leaving it up showing the "no lyrics" notice.
export const $hideNpvLyricsWhenUnavailable = persistAtom<boolean>(
  "hideNpvLyricsWhenUnavailable",
  true
);
// Off: a song that simply has no lyrics (not found, local file, DJ, podcast...) shows
// only the song info instead of the notice. Errors still show theirs. The NPV card
// has its own switch above.
export const $showNoLyricsNotice = persistAtom<boolean>("showNoLyricsNotice", true);
// Hide Spotify's own lyrics button in the playback bar (ours is left alone).
export const $removeSpotifyLyricsButton = persistAtom<boolean>("removeSpotifyLyricsButton", false);
export const $lockedMediaBox =persistAtom<boolean>("lockedMediaBox", false);
// $popupLyricsAllowed: stored as actual boolean "popupLyricsAllowed" in the settings blob.
export const $popupLyricsAllowed = (() => {
  const initial: boolean =
    _settings["popupLyricsAllowed"] !== undefined ? _settings["popupLyricsAllowed"] : true;
  const store = atom<boolean>(initial);
  store.listen((v) => {
    _settings["popupLyricsAllowed"] = v;
    saveSettingsBlob(_settings);
  });
  return store;
})();
export const $viewControlsPosition = persistAtom<string>("viewControlsPosition", "Top");
export const $ttmlMakerMode = persistAtom<boolean>("ttmlMakerMode", true);
// Last upload mode picked in the Local DB upload screen: "persistent" | "temporary".
export const $ttmlUploadMode = persistAtom<string>("ttmlUploadMode", "persistent");
export const $developerMode = persistAtom<boolean>("developerMode", false);
export const $timelineOutsideMediaContent = persistAtom<boolean>(
  "timelineOutsideMediaContent",
  true
);
// Volume band below the playback controls in Fullscreen / Cinema View / Popup Lyrics.
export const $showVolumeSlider = persistAtom<boolean>("showVolumeSlider", true);
// Playback timing offset in milliseconds (bipolar: negative = earlier, positive = later)
export const $playbackOffset = persistAtom<number>("playbackOffset", 0);
// Clicking a line seeks this much earlier, so Spotify's ~300ms fade-in on seek
// doesn't swallow the start of the line.
export const $seekFadeCompensation = persistAtom<boolean>("seekFadeCompensation", true);
// Start auto-scrolling to a line this many ms before it becomes active.
export const $scrollLeadEnabled = persistAtom<boolean>("scrollLeadEnabled", false);
export const $scrollLeadMs = persistAtom<number>("scrollLeadMs", 250);
// Spring-driven auto-scroll instead of the browser's native smooth scroll.
export const $smoothScrolling = persistAtom<boolean>("smoothScrolling", false);
// Frame rate cap for everything that redraws every frame (lyrics animation,
// animated background, smooth-scroll glide). On high refresh rate displays every
// extra frame is another repaint of the whole page, so this bounds the per-second
// work. Off by default, which draws on every display refresh as before; the
// slider value only applies once the cap is turned on.
export const $animationFpsCapEnabled = persistAtom<boolean>("animationFpsCapEnabled", false);
export const $animationFpsCap = persistAtom<number>("animationFpsCap", 60);

// Version atom — NOT persisted, set once at startup
export const $spicyLyricsVersion = atom<string>(
  (window as any)._spicy_lyrics_metadata?.LoadedVersion ?? ProjectVersion
);

// Runtime (ephemeral) atoms
export const $currentLyricsType = atom<string>("None");
export const $lyricsContainerExists = atom<boolean>(false);
export const $currentlyFetching = atom<boolean>(false);
export const $currentLyricsData = atom<string>("");

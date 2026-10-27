import { toast } from "sonner";
import { getExperiments, isExperimentEnabled } from "../experiments.ts";
import { GetRecentLogProblems, GetRecentUncaughtErrors } from "../Logger.ts";
import { getRemoteConfig } from "../remoteConfig.ts";
import { $currentLyricsData, $currentLyricsType, $spicyLyricsVersion, GetSavedSettings } from "../stores.ts";
import { GetForkRelease } from "./ForkRelease.ts";

// Settings → Advanced → Copy Debug Info: everything a bug fix usually needs, as text to
// paste into an issue. Nothing is sent anywhere; it only goes on the clipboard, so the
// person sees all of it before sharing. No account details: the only personal thing in
// it is the song playing, which bug reports ask for anyway.

/** Saved strings longer than this are cut, so a stray big value can't bury the rest. */
const MAX_VALUE_LENGTH = 200;

type SpicetifyConfig = {
  version?: string;
  current_theme?: string;
  color_scheme?: string;
  extensions?: string[];
  custom_apps?: string[];
};

function lyricsPage(): HTMLElement | null {
  const inMain = document.getElementById("SpicyLyricsPage");
  if (inMain) return inMain;
  // Popup Lyrics moves the page into its own window.
  // @ts-ignore: documentPictureInPicture is not yet standard
  const pip = globalThis.documentPictureInPicture?.window as Window | undefined;
  return pip?.document.getElementById("SpicyLyricsPage") ?? null;
}

function cutLongValues(settings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings).sort(([a], [b]) => a.localeCompare(b))) {
    out[key] =
      typeof value === "string" && value.length > MAX_VALUE_LENGTH
        ? `${value.slice(0, MAX_VALUE_LENGTH)}… (${value.length} chars)`
        : value;
  }
  return out;
}

function lyricsStatus(): string {
  const data = $currentLyricsData.get();
  if (!data) return "none loaded";
  if (data.startsWith("NO_LYRICS")) return "song has no lyrics";
  return `loaded (${data.length} chars)`;
}

/** The debug info as plain text, ready for a GitHub issue. */
export function CollectDebugInfo(): string {
  const platform = (Spicetify.Platform ?? {}) as { version?: string; operatingSystem?: string };
  const config = ((Spicetify as { Config?: SpicetifyConfig }).Config ?? {}) as SpicetifyConfig;
  const item = Spicetify.Player?.data?.item as
    | { uri?: string; name?: string; artists?: { name?: string }[]; album?: { uri?: string; name?: string } }
    | undefined;
  const page = lyricsPage();

  const lines: string[] = [];
  const section = (title: string) => lines.push("", `## ${title}`);
  const field = (name: string, value: unknown) => lines.push(`- ${name}: ${value ?? "unknown"}`);

  lines.push(`# Ruytha Edition debug info (${new Date().toISOString()})`);

  section("Versions");
  field("Ruytha Edition", GetForkRelease()?.name);
  field("Spicy Lyrics", $spicyLyricsVersion.get());
  field("Spotify", platform.version);
  field("Spicetify", config.version);
  field("OS", platform.operatingSystem ?? navigator.platform);
  field("User agent", navigator.userAgent);
  field("Language", navigator.language);

  section("Spicetify");
  field("Theme", config.current_theme ? `${config.current_theme} (${config.color_scheme || "default scheme"})` : "none");
  field("Extensions", config.extensions?.length ? config.extensions.join(", ") : "none");
  field("Custom apps", config.custom_apps?.length ? config.custom_apps.join(", ") : "none");

  section("Display");
  field("Window", `${window.innerWidth}×${window.innerHeight} at ${window.devicePixelRatio}x`);
  field("Screen", `${screen.width}×${screen.height}`);
  field("Reduced motion", window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  field("Window fullscreen", !!document.fullscreenElement);

  section("Lyrics page");
  field("Open", page ? (page.ownerDocument === document ? "yes" : "yes, in Popup Lyrics") : "no");
  if (page) {
    field("Page classes", page.className || "none");
    field("Size", `${page.clientWidth}×${page.clientHeight}`);
  }
  field("Lyrics type", $currentLyricsType.get());
  field("Lyrics", lyricsStatus());

  section("Playback");
  field("Playing", !!Spicetify.Player?.isPlaying?.());
  field("Song", item?.name ? `${item.name} by ${item.artists?.map((a) => a.name).join(", ")}` : "none");
  field("Song URI", item?.uri);
  field("Album", item?.album?.name ? `${item.album.name} (${item.album.uri})` : "unknown");
  field("Position", `${Math.round((Spicetify.Player?.getProgress?.() ?? 0) / 1000)}s`);

  section("Experiments");
  for (const exp of getExperiments()) {
    const forced = exp.forceState === undefined ? "" : ` (forced ${exp.forceState ? "on" : "off"})`;
    field(exp.id, `${isExperimentEnabled(exp.id) ? "on" : "off"}${forced}`);
  }

  section("Saved settings (changed from default)");
  lines.push("```json", JSON.stringify(cutLongValues(GetSavedSettings()), null, 2), "```");

  section("Remote config");
  lines.push("```json", JSON.stringify(getRemoteConfig()), "```");

  section("Recent warnings and errors");
  const problems = GetRecentLogProblems();
  if (problems.length) lines.push("```", ...problems, "```");
  else lines.push("None this session.");

  section("Uncaught errors (any code in the window, Spotify's too)");
  const crashes = GetRecentUncaughtErrors();
  if (crashes.length) lines.push("```", ...crashes, "```");
  else lines.push("None this session.");

  return lines.join("\n");
}

/** Puts the debug info on the clipboard and says so. */
export async function CopyDebugInfo() {
  let text: string;
  try {
    text = CollectDebugInfo();
  } catch (err) {
    toast.error("Couldn't gather the debug info", { description: String((err as Error)?.message ?? err) });
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // The clipboard API can refuse when the window isn't focused; Spotify's own copy still works.
    try {
      Spicetify.Platform?.ClipboardAPI?.copy(text);
    } catch (err) {
      toast.error("Couldn't copy the debug info", { description: String((err as Error)?.message ?? err) });
      return;
    }
  }
  toast.success("Debug info copied", {
    description: "Paste it into your bug report. It includes the song playing and your settings, no account details.",
  });
}

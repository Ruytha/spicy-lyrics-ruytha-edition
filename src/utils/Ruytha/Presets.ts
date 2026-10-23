// One-click looks for the settings panel, and settings backups. A look sets a group of
// settings at once; the toast after it can put every one of them back.
import { toast } from "sonner";
import { isExperimentEnabled, setExperiment } from "../experiments.ts";
import {
  $amllHidePassedLines,
  $amllLyricsBlur,
  $amllLyricsPosition,
  $amllLyricsScale,
  $amllLyricsSpring,
  $animatedCovers,
  $backgroundBeatPulse,
  $backgroundStyle,
  $bgBloom,
  $coverBeatPulse,
  $coverBlend,
  $coverMotionBackground,
  $lyricsFont,
  $lyricsRenderer,
  ExportSettings,
  ImportSettings,
} from "../stores.ts";

type Setter = { get: () => unknown; set: (v: never) => void };

/**
 * Apple Music's player: AMLL drawing the lyrics and the background, the album's Apple
 * Music animated cover with the page following it, the cover melted in, Apple's font,
 * and no beat effects (Apple Music doesn't pulse).
 */
const APPLE_MUSIC_LOOK: [Setter, unknown][] = [
  [$lyricsRenderer, "amll"],
  [$backgroundStyle, "amll"],
  [$animatedCovers, true],
  [$coverMotionBackground, true],
  [$coverBlend, true],
  [$lyricsFont, "sf"],
  [$amllLyricsBlur, true],
  [$amllLyricsSpring, true],
  [$amllLyricsScale, true],
  [$amllLyricsPosition, "upper"],
  [$amllHidePassedLines, false],
  [$backgroundBeatPulse, false],
  [$coverBeatPulse, false],
  [$bgBloom, 0],
];

export function ApplyAppleMusicLook() {
  const before = APPLE_MUSIC_LOOK.map(([store]) => [store, store.get()] as const);
  const stageBefore = isExperimentEnabled("canvasImmersive");
  for (const [store, value] of APPLE_MUSIC_LOOK) store.set(value as never);
  // The animated cover plays in the cover square, which Canvas Stage would replace.
  setExperiment("canvasImmersive", false);

  toast.success("Apple Music look on", {
    description: "AMLL, Apple Music animated covers, the melted cover and SF Pro.",
    action: {
      label: "Undo",
      onClick: () => {
        for (const [store, value] of before) store.set(value as never);
        setExperiment("canvasImmersive", stageBefore);
      },
    },
  });
}

/** Saves the settings as a .json file. */
export function DownloadSettingsBackup() {
  const blob = new Blob([ExportSettings()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ruytha-edition-settings-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  toast.success("Settings saved to a file");
}

/** Asks for a backup file, restores it and reloads, since settings are read at startup. */
export function RestoreSettingsBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      ImportSettings(await file.text());
    } catch (err) {
      toast.error("Couldn't restore that file", {
        description: err instanceof SyntaxError ? "It isn't valid JSON." : String((err as Error).message ?? err),
      });
      return;
    }
    toast.success("Settings restored. Reloading Spotify…");
    setTimeout(() => location.reload(), 1200);
  });
  input.click();
}

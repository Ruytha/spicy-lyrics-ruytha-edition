import { useStore } from "@nanostores/react";
import {
  $animationFpsCap,
  $animationFpsCapEnabled,
  $customFontName,
  $fontFileName,
  $fontFileVersion,
  $lyricsFont,
  type LyricsFont,
} from "../../../utils/stores.ts";
import { Select, Slider, TextInput, Toggle } from "./components.tsx";
import { AppearanceIcon } from "./icons.tsx";
import { ApplyAppleMusicLook } from "../../../utils/Ruytha/Presets.ts";
import { SaveFontFile } from "../../../utils/Ruytha/FontFile.ts";
import { toast } from "sonner";

/** Asks for a font file, keeps it, and switches the page to it. */
function pickFontFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".ttf,.otf,.woff,.woff2,font/*";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const saved = await SaveFontFile(file);
      $fontFileName.set(saved.name);
      $fontFileVersion.set($fontFileVersion.get() + 1);
      $lyricsFont.set("file");
      toast.success(`Using ${saved.name}`);
    } catch (err) {
      toast.error("Couldn't use that font", { description: (err as Error).message });
    }
  });
  input.click();
}
import type { GroupDef, SectionDef } from "./model.ts";

// Built once: the Control components must keep their identity across renders.
const groups: GroupDef[] = [
  {
    title: "Looks",
    settings: [
      {
        id: "appleMusicLook",
        label: "Apple Music Look",
        description:
          "Sets everything up like Apple Music's player in one go: AMLL lyrics and background, Apple Music animated covers with the background following them, the melted cover and SF Pro. Undo is on the message that pops up.",
        keywords: "preset apple music look theme one click style",
        reset: () => undefined,
        Control: () => (
          <button type="button" className="sl-sp-btn" onClick={ApplyAppleMusicLook}>
            Apply
          </button>
        ),
      },
    ],
  },
  {
    title: "Text",
    settings: [
      {
        id: "lyricsFont",
        label: "Font",
        description:
          "The font for the lyrics and the song info. SF Pro only shows if it's installed; otherwise Segoe UI stands in. Custom takes a Google Fonts name or an installed font's name. From a File uses a font file you pick, without installing it.",
        keywords: "font typeface system custom google sf pro apple geist inter poppins bricolage spicy",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($lyricsFont)}
            options={["spicy", "system", "sf", "geist", "inter", "bricolage", "poppins", "custom", "file"]}
            labels={["Spicy Lyrics", "Spotify's font", "SF Pro (Apple)", "Geist", "Inter", "Bricolage Grotesque", "Poppins", "Custom", "From a File"]}
            onChange={(v) => $lyricsFont.set(v as LyricsFont)}
          />
        ),
      },
      {
        id: "fontFile",
        label: "Font File",
        description: "A .ttf, .otf, .woff or .woff2 file. It's kept by Spotify, so the file can be moved or deleted afterwards.",
        keywords: "font file upload ttf otf woff custom local",
        reset: () => undefined,
        useNote: () => {
          const name = useStore($fontFileName);
          return useStore($lyricsFont) === "file" && !!name && `Using ${name}.`;
        },
        Control: () => (
          <button type="button" className="sl-sp-btn" onClick={pickFontFile}>
            {useStore($fontFileName) ? "Change File" : "Choose File"}
          </button>
        ),
      },
      {
        id: "customFontName",
        label: "Custom Font",
        description:
          "A font name from fonts.google.com, or the name of a font installed on this computer, as Windows' Fonts settings list it. Press Enter to apply.",
        keywords: "custom font google fonts name family",
        useDisabled: () => useStore($lyricsFont) !== "custom" && "Pick Custom under Font first.",
        Control: ({ disabled, label }) => (
          <TextInput
            label={label}
            value={useStore($customFontName)}
            placeholder="e.g. Space Grotesk"
            onChange={(v) => $customFontName.set(v)}
            disabled={disabled}
          />
        ),
      },
    ],
  },
  {
    title: "Performance",
    settings: [
      {
        id: "animationFpsCapEnabled",
        label: "Limit Frame Rate",
        description:
          "Redraw the lyrics, background and scroll less often to save CPU, especially on high refresh rate displays.",
        keywords: "fps cap animation",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($animationFpsCapEnabled)}
            onChange={(v) => $animationFpsCapEnabled.set(v)}
          />
        ),
      },
      {
        id: "animationFpsCap",
        label: "Frame Rate",
        description: "Frames per second while the limit is on.",
        keywords: "fps cap animation",
        stacked: true,
        useDisabled: () =>
          !useStore($animationFpsCapEnabled) && "Turn on Limit Frame Rate to change this.",
        Control: ({ disabled, label }) => (
          <Slider
            label={label}
            value={useStore($animationFpsCap)}
            min={15}
            max={240}
            step={5}
            defaultValue={60}
            unit="FPS"
            onChange={(v) => $animationFpsCap.set(v)}
            disabled={disabled}
          />
        ),
      },
    ],
  },
];

export const appearanceSection: SectionDef = {
  id: "appearance",
  title: "Appearance",
  resettable: true,
  intro: "Fonts and how hard the page works to draw itself.",
  icon: AppearanceIcon,
  groups: () => groups,
};

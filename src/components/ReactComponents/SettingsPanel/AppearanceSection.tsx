import { useStore } from "@nanostores/react";
import {
  $animationFpsCap,
  $animationFpsCapEnabled,
  $customFontName,
  $lyricsFont,
  type LyricsFont,
} from "../../../utils/stores.ts";
import { Select, Slider, TextInput, Toggle } from "./components.tsx";
import { AppearanceIcon } from "./icons.tsx";
import { ApplyAppleMusicLook } from "../../../utils/Ruytha/Presets.ts";
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
          "The font for the lyrics and the song info. SF Pro only shows if it's installed; otherwise Segoe UI stands in. Custom takes any Google Fonts name.",
        keywords: "font typeface system custom google sf pro apple geist inter poppins bricolage spicy",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($lyricsFont)}
            options={["spicy", "system", "sf", "geist", "inter", "bricolage", "poppins", "custom"]}
            labels={["Spicy Lyrics", "Spotify's font", "SF Pro (Apple)", "Geist", "Inter", "Bricolage Grotesque", "Poppins", "Custom"]}
            onChange={(v) => $lyricsFont.set(v as LyricsFont)}
          />
        ),
      },
      {
        id: "customFontName",
        label: "Custom Font",
        description: "A font name from fonts.google.com, or one installed on this computer. Press Enter to apply.",
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

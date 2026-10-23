import { useStore } from "@nanostores/react";
import {
  $amllBgFlowSpeed,
  $amllBgStaticMode,
  $backgroundBeatPulse,
  $backgroundBlur,
  $backgroundStyle,
  $beatPulseStrength,
  $bgBloom,
  $bgBrightness,
  $bgContrast,
  $bgRenderQuality,
  $bgSaturation,
  $ruythaSpotlight,
  $showNpvDynamicBg,
  BACKGROUND_STYLES,
  type BackgroundStyle,
  type BeatPulseStrength,
  type RenderQuality,
} from "../../../utils/stores.ts";
import { $experiment, getExperiment } from "../../../utils/experiments.ts";
import { Select, Slider, Toggle } from "./components.tsx";
import { BackgroundIcon } from "./icons.tsx";
import type { GroupDef, SectionDef, SettingDef } from "./model.ts";
import type { WritableAtom } from "nanostores";

const useNoBackground = () => useStore($backgroundStyle) === "none" && "There's no background to change.";

/** A 0 to 200% slider for one of the background's render controls. */
function renderSlider(
  id: string,
  label: string,
  description: string,
  keywords: string,
  store: WritableAtom<number>,
  max = 200,
  defaultValue = 100
): SettingDef {
  return {
    id,
    label,
    description,
    keywords,
    stacked: true,
    useDisabled: useNoBackground,
    Control: ({ disabled, label: rowLabel }) => (
      <Slider
        label={rowLabel}
        value={useStore(store)}
        min={0}
        max={max}
        step={5}
        defaultValue={defaultValue}
        unit="%"
        onChange={(v) => store.set(v)}
        disabled={disabled}
      />
    ),
  };
}

export const BACKGROUND_STYLE_LABELS: Record<BackgroundStyle, string> = {
  dynamic: "Dynamic (Kawarp)",
  amll: "AMLL",
  starry: "Starry Night",
  artist: "Artist Image",
  cover: "Cover Art",
  color: "Cover Colors",
  none: "None (Transparent)",
};

// Built once: the Control components must keep their identity across renders.
const groups: GroupDef[] = [
  {
    title: "Lyrics View",
    settings: [
      {
        id: "backgroundStyle",
        label: "Background",
        description:
          "Dynamic (Kawarp) swirls the cover art in time with the music. AMLL flows the cover's colors as a soft mesh gradient. Starry Night is a fixed night sky with twinkling stars. Artist Image uses the artist's header photo, or the cover when there isn't one. None (Transparent) leaves the page see-through, so whatever is behind it shows.",
        keywords: "static animated kawarp amll mesh gradient starry night stars sky artist header cover art color colors image transparent none theme",
        useNote: () => {
          const style = useStore($backgroundStyle);
          const canvasStage = useStore($experiment("canvasImmersive"));
          return (
            style === "none" &&
            canvasStage &&
            `${getExperiment("canvasImmersive").label} needs a background, so it won't show with None.`
          );
        },
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($backgroundStyle)}
            options={[...BACKGROUND_STYLES]}
            labels={BACKGROUND_STYLES.map((style) => BACKGROUND_STYLE_LABELS[style])}
            onChange={(v) => $backgroundStyle.set(v as BackgroundStyle)}
          />
        ),
      },
      {
        id: "backgroundBlur",
        label: "Image Blur",
        description: "Softens the Artist Image and Cover Art backgrounds.",
        keywords: "static background blur",
        stacked: true,
        useDisabled: () => {
          const style = useStore($backgroundStyle);
          return style !== "artist" && style !== "cover" && "Only applies to Artist Image and Cover Art.";
        },
        Control: ({ disabled, label }) => (
          <Slider
            label={label}
            value={useStore($backgroundBlur)}
            min={0}
            max={48}
            step={1}
            defaultValue={0}
            unit="px"
            onChange={(v) => $backgroundBlur.set(v)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "backgroundBeatPulse",
        label: "Pulse to the Beat",
        description:
          "The background swells a little on each beat and eases back. It follows Spotify's beat data, so songs without it stay still.",
        keywords: "beat pulse throb music bass rhythm background",
        useDisabled: () => useStore($backgroundStyle) === "none" && "There's no background to pulse.",
        Control: ({ disabled, label }) => (
          <Toggle
            label={label}
            checked={useStore($backgroundBeatPulse)}
            onChange={(v) => $backgroundBeatPulse.set(v)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "beatPulseStrength",
        label: "Pulse Strength",
        description: "How far the background swells and brightens on each beat.",
        keywords: "beat pulse strength intensity amount subtle strong",
        useDisabled: () => {
          const on = useStore($backgroundBeatPulse);
          const style = useStore($backgroundStyle);
          return (!on || style === "none") && "Turn on Pulse to the Beat first.";
        },
        Control: ({ disabled, label }) => (
          <Select
            label={label}
            value={useStore($beatPulseStrength)}
            options={["subtle", "normal", "strong"]}
            labels={["Subtle", "Normal", "Strong"]}
            onChange={(v) => $beatPulseStrength.set(v as BeatPulseStrength)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "ruythaSpotlight",
        label: "Spotlight Ruytha's Syncs",
        description:
          "Songs synced by Ruytha, who makes this fork, get shooting stars across the background, a banner when they start, and a ring around Ruytha in the credits.",
        keywords: "ruytha spotlight shooting stars banner credits effect fork",
        Control: ({ label }) => (
          <Toggle label={label} checked={useStore($ruythaSpotlight)} onChange={(v) => $ruythaSpotlight.set(v)} />
        ),
      },
      {
        id: "amllBgFlowSpeed",
        label: "AMLL Flow Speed",
        description: "How fast the AMLL background moves. It still slows down while playback is paused.",
        keywords: "amll background flow speed animation",
        stacked: true,
        useDisabled: () => useStore($backgroundStyle) !== "amll" && "Only applies to AMLL.",
        Control: ({ disabled, label }) => (
          <Slider
            label={label}
            value={useStore($amllBgFlowSpeed)}
            min={0.25}
            max={4}
            step={0.25}
            defaultValue={1}
            unit="x"
            onChange={(v) => $amllBgFlowSpeed.set(v)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "amllBgStaticMode",
        label: "AMLL Still Mode",
        description: "Draw each cover once and hold it still instead of animating, to save GPU.",
        keywords: "amll background static still performance gpu",
        useDisabled: () => useStore($backgroundStyle) !== "amll" && "Only applies to AMLL.",
        Control: ({ disabled, label }) => (
          <Toggle
            label={label}
            checked={useStore($amllBgStaticMode)}
            onChange={(v) => $amllBgStaticMode.set(v)}
            disabled={disabled}
          />
        ),
      },
    ],
  },
  {
    title: "Render",
    settings: [
      renderSlider(
        "bgBloom",
        "Bloom",
        "Makes the bright parts of the background glow and spill into the rest.",
        "bloom glow light bright render effect",
        $bgBloom,
        100,
        0
      ),
      renderSlider(
        "bgBrightness",
        "Brightness",
        "How light the background is. Lower keeps the lyrics easier to read.",
        "brightness dim dark light render",
        $bgBrightness
      ),
      renderSlider(
        "bgSaturation",
        "Saturation",
        "How strong the background's colors are. 0% is black and white.",
        "saturation color vivid grayscale render",
        $bgSaturation
      ),
      renderSlider(
        "bgContrast",
        "Contrast",
        "How far apart the background's light and dark parts are.",
        "contrast render",
        $bgContrast
      ),
      {
        id: "bgRenderQuality",
        label: "AMLL Render Quality",
        description: "How sharp the AMLL background is drawn. High costs the most GPU; the blur hides most of the difference.",
        keywords: "amll render quality resolution scale gpu performance",
        useDisabled: () => useStore($backgroundStyle) !== "amll" && "Only applies to AMLL.",
        Control: ({ disabled, label }) => (
          <Select
            label={label}
            value={useStore($bgRenderQuality)}
            options={["low", "medium", "high"]}
            labels={["Low", "Medium", "High"]}
            onChange={(v) => $bgRenderQuality.set(v as RenderQuality)}
            disabled={disabled}
          />
        ),
      },
    ],
  },
  {
    title: "Now Playing Sidebar",
    settings: [
      {
        id: "showNpvDynamicBg",
        label: "Animated Background",
        description: "Show the Dynamic (Kawarp) background behind the Now Playing sidebar.",
        keywords: "dynamic background npv now playing view kawarp",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($showNpvDynamicBg)}
            onChange={(v) => $showNpvDynamicBg.set(v)}
          />
        ),
      },
    ],
  },
];

export const backgroundSection: SectionDef = {
  id: "background",
  title: "Background",
  intro: "What sits behind the lyrics, how it moves with the music, and how it renders.",
  icon: BackgroundIcon,
  groups: () => groups,
};

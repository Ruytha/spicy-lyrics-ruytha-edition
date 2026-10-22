import { useStore } from "@nanostores/react";
import {
  $amllBgFlowSpeed,
  $amllBgStaticMode,
  $backgroundBlur,
  $backgroundStyle,
  $showNpvDynamicBg,
  BACKGROUND_STYLES,
  type BackgroundStyle,
} from "../../../utils/stores.ts";
import { $experiment, getExperiment } from "../../../utils/experiments.ts";
import { Select, Slider, Toggle } from "./components.tsx";
import { BackgroundIcon } from "./icons.tsx";
import type { GroupDef, SectionDef } from "./model.ts";

export const BACKGROUND_STYLE_LABELS: Record<BackgroundStyle, string> = {
  dynamic: "Dynamic (Kawarp)",
  amll: "AMLL",
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
          "Dynamic (Kawarp) swirls the cover art in time with the music. AMLL flows the cover's colors as a soft mesh gradient. Artist Image uses the artist's header photo, or the cover when there isn't one. None (Transparent) leaves the page see-through, so whatever is behind it shows.",
        keywords: "static animated kawarp amll mesh gradient artist header cover art color colors image transparent none theme",
        useNote: () => {
          const style = useStore($backgroundStyle);
          const canvasStage = useStore($experiment("canvasImmersive"));
          return (
            style !== "dynamic" &&
            canvasStage &&
            `${getExperiment("canvasImmersive").label} only plays over Dynamic (Kawarp), so it won't show with ${BACKGROUND_STYLE_LABELS[style] ?? "this background"}.`
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
  icon: BackgroundIcon,
  groups: () => groups,
};

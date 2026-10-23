import { useStore } from "@nanostores/react";
import type { WritableAtom } from "nanostores";
import {
  $amllHidePassedLines,
  $amllLyricsBlur,
  $amllLyricsPosition,
  $amllLyricsScale,
  $amllLyricsSpring,
  $timingOverlay,
  $creditsFollowLastLine,
  $duetLinePadding,
  $joinSplitWords,
  $lineHoverBackground,
  $lyricsRenderer,
  $minimalLyricsMode,
  $simpleLyricsMode,
} from "../../../utils/stores.ts";
import { Select, Toggle } from "./components.tsx";
import { LyricsIcon } from "./icons.tsx";
import type { GroupDef, SectionDef, SettingDef } from "./model.ts";

const useAmllOnly = () => useStore($lyricsRenderer) !== "amll" && "Only applies to the AMLL renderer.";

/** A toggle for one of the AMLL player's own options. */
function amllToggle(
  id: string,
  label: string,
  description: string,
  keywords: string,
  store: WritableAtom<boolean>
): SettingDef {
  return {
    id,
    label,
    description,
    keywords,
    useDisabled: useAmllOnly,
    Control: ({ disabled, label: rowLabel }) => (
      <Toggle label={rowLabel} checked={useStore(store)} onChange={(v) => store.set(v)} disabled={disabled} />
    ),
  };
}

// Built once: the Control components must keep their identity across renders.
const groups: GroupDef[] = [
  {
    title: "Style",
    settings: [
      {
        id: "lyricsRenderer",
        label: "Lyrics Renderer",
        description:
          "Which renderer draws synced lyrics. AMLL scrolls and highlights lines with its own layout and effects; Simple and Minimal Lyrics Mode only apply to Spicy. Unsynced lyrics always use Spicy.",
        keywords: "amll renderer player engine",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($lyricsRenderer)}
            options={["spicy", "amll"]}
            labels={["Spicy", "AMLL"]}
            onChange={(v) => $lyricsRenderer.set(v)}
          />
        ),
      },
      {
        id: "simpleLyricsMode",
        label: "Simple Lyrics Mode",
        description: "Drop the extra visual effects from the lyrics.",
        keywords: "effects plain",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($simpleLyricsMode)}
            onChange={(v) => $simpleLyricsMode.set(v)}
          />
        ),
      },
      {
        id: "minimalLyricsMode",
        label: "Minimal Lyrics Mode",
        description: "Hide lines that have already been sung in Fullscreen and Cinema View.",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($minimalLyricsMode)}
            onChange={(v) => $minimalLyricsMode.set(v)}
          />
        ),
      },
      {
        id: "joinSplitWords",
        label: "Join Split Words",
        description: "Show a word that's sung in syllables as one word, when its parts line up evenly.",
        keywords: "syllables merge",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($joinSplitWords)}
            onChange={(v) => $joinSplitWords.set(v)}
          />
        ),
      },
    ],
  },
  {
    title: "Lines",
    settings: [
      {
        id: "lineHoverBackground",
        label: "Highlight on Hover",
        description: "Show a soft box behind a line when you point at it.",
        keywords: "line hover background",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($lineHoverBackground)}
            onChange={(v) => $lineHoverBackground.set(v)}
          />
        ),
      },
      {
        id: "duetLinePadding",
        label: "Duet Line Padding",
        description: "Indent each singer's lines toward their side, so duets read as two columns.",
        keywords: "indent voices",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($duetLinePadding)}
            onChange={(v) => $duetLinePadding.set(v)}
          />
        ),
      },
      {
        id: "creditsFollowLastLine",
        label: "Credits Follow the Last Singer",
        description:
          "When a song ends on a duet line on the right, show the songwriter and provider lines on the right too.",
        keywords: "duet credits written by songwriters provided by provider align side",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($creditsFollowLastLine)}
            onChange={(v) => $creditsFollowLastLine.set(v)}
          />
        ),
      },
    ],
  },
  {
    title: "AMLL Lyrics",
    settings: [
      amllToggle(
        "amllLyricsBlur",
        "Blur Other Lines",
        "Soften the lines around the one playing, so it stands out.",
        "amll blur depth focus",
        $amllLyricsBlur
      ),
      amllToggle(
        "amllLyricsSpring",
        "Springy Motion",
        "Lines bounce into place as they scroll. Off, they glide straight there.",
        "amll spring bounce physics animation",
        $amllLyricsSpring
      ),
      amllToggle(
        "amllLyricsScale",
        "Enlarge the Playing Line",
        "Make the line being sung slightly bigger than the rest.",
        "amll scale zoom size active line",
        $amllLyricsScale
      ),
      {
        id: "amllLyricsPosition",
        label: "Playing Line Position",
        description: "Where the line being sung sits on the page.",
        keywords: "amll align position center middle top",
        useDisabled: useAmllOnly,
        Control: ({ disabled, label }) => (
          <Select
            label={label}
            value={useStore($amllLyricsPosition)}
            options={["upper", "center"]}
            labels={["Upper third", "Middle"]}
            onChange={(v) => $amllLyricsPosition.set(v as "upper" | "center")}
            disabled={disabled}
          />
        ),
      },
      amllToggle(
        "amllHidePassedLines",
        "Hide Sung Lines",
        "Fade out lines once they've been sung, leaving only what's coming.",
        "amll hide passed previous lines",
        $amllHidePassedLines
      ),
    ],
  },
  {
    title: "For Syncers",
    settings: [
      {
        id: "timingOverlay",
        label: "Timing Overlay",
        description:
          "Show the playback time to the millisecond, with the start and end of the line and word playing. Click it to copy the time.",
        keywords: "timing timestamp milliseconds sync ttml debug overlay word",
        Control: ({ label }) => (
          <Toggle label={label} checked={useStore($timingOverlay)} onChange={(v) => $timingOverlay.set(v)} />
        ),
      },
    ],
  },
];

export const lyricsSection: SectionDef = {
  id: "lyrics",
  title: "Lyrics",
  icon: LyricsIcon,
  groups: () => groups,
};

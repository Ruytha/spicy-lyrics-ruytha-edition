import { useStore } from "@nanostores/react";
import {
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
import type { GroupDef, SectionDef } from "./model.ts";

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
];

export const lyricsSection: SectionDef = {
  id: "lyrics",
  title: "Lyrics",
  icon: LyricsIcon,
  groups: () => groups,
};

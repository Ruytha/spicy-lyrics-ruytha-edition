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
  $lineHoverBackground,
  $lyricGlow,
  $lyricsRenderer,
  $translationsBelow,
  $singleLineMode,
  $lyricsSize,
  $minimalLyricsMode,
  $pinnedCredits,
  $rendererVisualStyle,
  $romanizationDisplay,
  $syllableMerge,
  $syllablePace,
  RENDERER_VISUAL_STYLES,
  RENDERER_VISUAL_STYLE_LABELS,
  type PinnedCredits,
  type RendererVisualStyle,
  type RomanizationDisplay,
  type SyllableMerge,
} from "../../../utils/stores.ts";
import { Select, Slider, Toggle } from "./components.tsx";
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
    title: "Text",
    settings: [
      {
        id: "lyricsSize",
        label: "Lyrics Size",
        description:
          "Makes the lyrics bigger or smaller in every view, including romanization and background vocals. 100% is each view's usual size.",
        keywords: "font text scale bigger smaller zoom",
        stacked: true,
        Control: ({ label }) => (
          <Slider
            label={label}
            value={useStore($lyricsSize)}
            min={60}
            max={200}
            step={5}
            defaultValue={100}
            unit="%"
            onChange={(v) => $lyricsSize.set(v)}
          />
        ),
      },
    ],
  },
  {
    title: "Style",
    settings: [
      {
        id: "lyricsRenderer",
        label: "Lyrics Renderer",
        description:
          "Which renderer draws synced lyrics. AMLL scrolls and highlights lines with its own layout and effects. Review is plain, for checking a sync: each word fills evenly from its start time to its end time and pops up as it starts. Renderer Visual Style and Fade Away Previous Lines only apply to Spicy. Unsynced lyrics always use Spicy.",
        keywords: "amll review toxi renderer player engine timing sync check",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($lyricsRenderer)}
            options={["spicy", "amll", "review"]}
            labels={["Spicy", "AMLL", "Review"]}
            onChange={(v) => $lyricsRenderer.set(v)}
          />
        ),
      },
      {
        id: "lyricGlow",
        label: "Lyric Glow",
        description:
          "How much the words glow as they're sung. With AMLL the playing line glows softly instead. 0% turns the glow off.",
        keywords: "glow bloom shine text shadow sung words amll",
        stacked: true,
        Control: ({ disabled, label }) => (
          <Slider
            label={label}
            value={useStore($lyricGlow)}
            min={0}
            max={250}
            step={10}
            defaultValue={100}
            unit="%"
            onChange={(v) => $lyricGlow.set(v)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "rendererVisualStyle",
        label: "Renderer Visual Style",
        description:
          "Visual design of rendered lyrics. \"Spring\" is the default Spicy Lyrics renderer you know.",
        keywords: "simple lyrics mode refreshed renderer animation effects plain spring bloom",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($rendererVisualStyle)}
            options={[...RENDERER_VISUAL_STYLES]}
            labels={RENDERER_VISUAL_STYLES.map((style) => RENDERER_VISUAL_STYLE_LABELS[style])}
            onChange={(v) => $rendererVisualStyle.set(v as RendererVisualStyle)}
          />
        ),
      },
      {
        id: "minimalLyricsMode",
        label: "Fade Away Previous Lines",
        description: "Hide lines that have already been sung in Fullscreen and Cinema View.",
        keywords: "minimal lyrics mode hide sung",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($minimalLyricsMode)}
            onChange={(v) => $minimalLyricsMode.set(v)}
          />
        ),
      },
      {
        id: "singleLineMode",
        label: "Single Line Mode",
        description:
          "Show only the line being sung and hide the rest, leaving the screen empty between lines. Unsynced lyrics still show in full.",
        keywords: "one line current focus",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($singleLineMode)}
            onChange={(v) => $singleLineMode.set(v)}
          />
        ),
      },
      {
        id: "syllableMerge",
        label: "Join Split Words",
        description:
          "Show a word sung in syllables as one word. Steadily Sung keeps only words with no gap and an even pace between parts; Held Words only those long enough to light up letter by letter.",
        keywords: "syllables merge held steady",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($syllableMerge)}
            options={["off", "full", "steady", "held"]}
            labels={["Off", "All Words", "Steadily Sung", "Held Words"]}
            onChange={(v) => $syllableMerge.set(v as SyllableMerge)}
          />
        ),
      },
      {
        id: "syllablePace",
        label: "Keep Syllable Pace",
        description:
          "A joined word that lights up letter by letter follows each syllable's timing, slow on a long syllable and quick on a short one.",
        keywords: "syllables merge held letters timing",
        useDisabled: () => useStore($syllableMerge) === "off" && "Pick a Join Split Words mode to change this.",
        Control: ({ disabled, label }) => (
          <Toggle
            label={label}
            checked={useStore($syllablePace)}
            onChange={(v) => $syllablePace.set(v)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "translationsBelow",
        label: "Translations Under the Lyrics",
        description:
          "When the lyrics come with a translation, show it as a smaller line under each lyric, like Apple Music. The Translation button by the lyrics turns it on and off too; it only shows for lyrics that have one.",
        keywords: "translation translate english meaning under below apple music ttml language",
        Control: ({ label }) => (
          <Toggle
            label={label}
            checked={useStore($translationsBelow)}
            onChange={(v) => $translationsBelow.set(v)}
          />
        ),
      },
    ],
  },
  {
    title: "Lines",
    settings: [
      {
        id: "romanizationDisplay",
        label: "Romanization",
        description:
          "With romanization on, show it in place of the original lyrics, or as a smaller row under each line.",
        keywords: "romaji romanized romanize pronunciation under below replace",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($romanizationDisplay)}
            options={["replace", "underLine"]}
            labels={["Replace the line", "Under each line"]}
            onChange={(v) => $romanizationDisplay.set(v as RomanizationDisplay)}
          />
        ),
      },
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
      {
        id: "pinnedCredits",
        label: "Pinned Credits",
        description:
          "Keep the credits at the bottom of the lyrics while they scroll. No Writers pins the lyrics source and community line, Full pins the songwriters too.",
        keywords: "credits footer pin sticky written by songwriters provided by source community bottom",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($pinnedCredits)}
            options={["off", "noWriters", "full"]}
            labels={["Off", "No Writers", "Full"]}
            onChange={(v) => $pinnedCredits.set(v as PinnedCredits)}
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
  resettable: true,
  intro: "How the lyrics are drawn, and the options for each renderer.",
  icon: LyricsIcon,
  groups: () => groups,
};

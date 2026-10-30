import { useStore } from "@nanostores/react";
import { $experiment, setExperiment } from "../../../utils/experiments.ts";
import {
  $animatedCovers,
  $coverMotionBackground,
  $coverBeatPulse,
  $coverBlend,
  $autoCoverOnly,
  $coverOnlyMode,
  $preferAnimatedCover,
} from "../../../utils/stores.ts";
import { Select, Toggle } from "./components.tsx";
import { CoverIcon } from "./icons.tsx";
import type { GroupDef, SectionDef } from "./model.ts";

type CanvasMode = "stage" | "cover" | "off";

// One choice over two switches: Canvas Stage (an experiment) and Apple Music animated covers.
function useCanvasMode(): CanvasMode {
  const stage = useStore($experiment("canvasImmersive"));
  const animated = useStore($animatedCovers);
  return stage ? "stage" : animated ? "cover" : "off";
}

function setCanvasMode(mode: CanvasMode) {
  setExperiment("canvasImmersive", mode === "stage");
  // Animated covers stay on under the stage: they fill the views it doesn't (compact mode).
  $animatedCovers.set(mode !== "off");
}

// Built once: the Control components must keep their identity across renders.
const groups: GroupDef[] = [
  {
    title: "Motion",
    settings: [
      {
        id: "canvasMode",
        reset: () => setCanvasMode("stage"),
        label: "Moving Artwork",
        description:
          "Spotify Canvas fills the cover's half of the page with the song's Canvas video. Apple Music Cover plays the album's animated cover from Apple Music inside the cover square, for albums that have one (After Hours, say). Off keeps the still cover.",
        keywords: "canvas video animated cover artwork motion stage apple music banner",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useCanvasMode()}
            options={["stage", "cover", "off"]}
            labels={["Spotify Canvas", "Apple Music Cover", "Off"]}
            onChange={(v) => setCanvasMode(v as CanvasMode)}
          />
        ),
      },
      {
        id: "preferAnimatedCover",
        label: "Prefer the Animated Cover",
        description:
          "When an album has an Apple Music animated cover, play that in the cover square instead of the song's Canvas. Songs without one still get their Canvas.",
        keywords: "canvas animated cover apple music prefer instead priority hide canvas",
        useDisabled: () =>
          useCanvasMode() !== "stage" && "Set Moving Artwork to Spotify Canvas first.",
        Control: ({ disabled, label }) => (
          <Toggle
            label={label}
            checked={useStore($preferAnimatedCover)}
            onChange={(v) => $preferAnimatedCover.set(v)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "coverMotionBackground",
        label: "Background Follows the Cover",
        description:
          "While an Apple Music animated cover plays, the page background is drawn from it, so the whole page moves with the artwork. Turn it off to keep your own background (AMLL, Kawarp and the rest) behind animated covers.",
        keywords: "apple music animated cover background motion moving video ambient keep amll kawarp change",
        // Animated covers also play under Spotify Canvas (Prefer the Animated Cover, compact mode).
        useDisabled: () => useCanvasMode() === "off" && "Turn on Moving Artwork first.",
        Control: ({ disabled, label }) => (
          <Toggle
            label={label}
            checked={useStore($coverMotionBackground)}
            onChange={(v) => $coverMotionBackground.set(v)}
            disabled={disabled}
          />
        ),
      },
      {
        id: "coverBeatPulse",
        label: "Move to the Beat",
        description: "The cover swells a little on each beat, like the background does. Uses the Pulse Strength setting.",
        keywords: "cover beat pulse bounce music rhythm throb",
        Control: ({ label }) => (
          <Toggle label={label} checked={useStore($coverBeatPulse)} onChange={(v) => $coverBeatPulse.set(v)} />
        ),
      },
    ],
  },
  {
    title: "Look",
    settings: [
      {
        id: "coverBlend",
        label: "Melt into Background",
        description:
          "Drop the cover's frame and shadow and fade its edges into the background, like Apple Music's full-bleed artwork.",
        keywords: "cover blend morph soft edges fade feather apple music background",
        Control: ({ label }) => (
          <Toggle label={label} checked={useStore($coverBlend)} onChange={(v) => $coverBlend.set(v)} />
        ),
      },
      {
        id: "coverOnlyMode",
        label: "Cover Only",
        description:
          "Hide the lyrics and show the cover large in the middle of the page. Also on the lyrics page's buttons, or press C.",
        keywords: "cover only no lyrics hide lyrics artwork big album art mode",
        Control: ({ label }) => (
          <Toggle label={label} checked={useStore($coverOnlyMode)} onChange={(v) => $coverOnlyMode.set(v)} />
        ),
      },
      {
        id: "autoCoverOnly",
        label: "Cover Only for Songs Without Lyrics",
        description:
          "When a song has no lyrics, show its cover large in the middle of the page instead of a notice. The lyrics come back with the next song that has them.",
        keywords: "cover only no lyrics automatic auto instrumental notice missing",
        Control: ({ label }) => (
          <Toggle label={label} checked={useStore($autoCoverOnly)} onChange={(v) => $autoCoverOnly.set(v)} />
        ),
      },
    ],
  },
];

export const coverSection: SectionDef = {
  id: "cover",
  title: "Cover",
  resettable: true,
  intro: "The album cover: moving artwork, the beat, and how it sits on the page.",
  icon: CoverIcon,
  groups: () => groups,
};

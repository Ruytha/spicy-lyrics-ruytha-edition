import { useStore } from "@nanostores/react";
import { $experiment, setExperiment } from "../../../utils/experiments.ts";
import {
  $animatedCovers,
  $coverBeatPulse,
  $coverBlend,
  $coverOnlyMode,
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
    ],
  },
];

export const coverSection: SectionDef = {
  id: "cover",
  title: "Cover",
  intro: "The album cover: moving artwork, the beat, and how it sits on the page.",
  icon: CoverIcon,
  groups: () => groups,
};

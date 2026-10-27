import { toast } from "sonner";
import { SpotifyPlayer } from "../../../components/Global/SpotifyPlayer";
import fetchLyrics from "../fetchLyrics";
import ApplyLyrics from "../Global/Applyer";
import { ProcessLyrics } from "../ProcessLyrics";
import { $currentLyricsData } from "../../stores";
import Logger from "../../Logger";
import { ParseTTML } from "./parseTTML";

// A TTML applied to the playing song only: nothing goes in the Local Lyrics DB, so the
// song's own lyrics come back once it's played again or Spotify restarts. Used by the
// Lyrics Manager's "Just once" mode and the Load TTML File button on the lyrics page.

const logger = new Logger("Temporary TTML");

/** Parses `ttml` and shows it for `uri` until the lyrics load again. False if it didn't parse. */
export async function ApplyTemporaryTTML(ttml: string, uri: string): Promise<boolean> {
  const result = ParseTTML(ttml);
  if (!result) {
    toast.error("Failed to parse TTML.", { duration: 5000 });
    return false;
  }
  const dataToSave = { ...result, uri };
  await ProcessLyrics(dataToSave);
  $currentLyricsData.set(JSON.stringify(dataToSave));
  setTimeout(() => {
    fetchLyrics(uri)
      .then((lyrics) => {
        ApplyLyrics(lyrics);
        toast.success("Lyrics Parsed and Applied!", { duration: 5000 });
      })
      .catch((err) => {
        toast.error("Error applying lyrics", { duration: 5000 });
        logger.error("Error applying lyrics:", err);
      });
  }, 25);
  return true;
}

/**
 * Opens the file picker and applies the picked .ttml to the playing song for now.
 * `doc` is the document the button lives in (Popup Lyrics has its own window).
 */
export function PickTemporaryTTML(doc: Document = document) {
  const input = doc.createElement("input");
  input.type = "file";
  input.accept = ".ttml";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ttml")) {
      toast.error("Only .ttml files are supported.", { duration: 5000 });
      return;
    }
    // The song at the moment of picking, not of opening the picker: it can change while the dialog is open.
    const uri = SpotifyPlayer.GetUri();
    if (!uri) {
      toast.error("No track is currently playing.", { duration: 5000 });
      return;
    }
    try {
      await ApplyTemporaryTTML(await file.text(), uri);
    } catch (err) {
      toast.error("Error reading TTML file.", { duration: 5000 });
      logger.error("Temporary TTML failed:", err);
    }
  });
  input.click();
}

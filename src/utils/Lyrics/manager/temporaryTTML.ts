import { atom } from "nanostores";
import { toast } from "sonner";
import { SpotifyPlayer } from "../../../components/Global/SpotifyPlayer";
import fetchLyrics from "../fetchLyrics";
import ApplyLyrics from "../Global/Applyer";
import { ProcessLyrics } from "../ProcessLyrics";
import { $currentLyricsData, $ttmlMakerMode } from "../../stores";
import Logger from "../../Logger";
import { ParseTTML } from "./parseTTML";

// A TTML applied to the playing song only: nothing goes in the Local Lyrics DB, so the
// song's own lyrics come back once it's played again or Spotify restarts. Used by the
// Lyrics Manager's "Just once" mode, the Load TTML File button, and a .ttml dropped on or
// pasted into the lyrics page.

const logger = new Logger("Temporary TTML");

/** The lyrics data a temporary TTML put in place, while it's still the one showing. */
let temporaryData: string | null = null;

/** The song a temporary TTML is showing on, or null. The page's badge follows it. */
export const $temporaryLyricsUri = atom<string | null>(null);

// Any other lyrics taking over (a new song, a reload, a revert) ends the temporary ones.
$currentLyricsData.listen((data) => {
  if (temporaryData !== null && data !== temporaryData) {
    temporaryData = null;
    $temporaryLyricsUri.set(null);
  }
});

/** Parses `ttml` and shows it for `uri` until the lyrics load again. False if it didn't parse. */
export async function ApplyTemporaryTTML(ttml: string, uri: string): Promise<boolean> {
  const result = ParseTTML(ttml);
  if (!result) {
    toast.error("Failed to parse TTML.", { duration: 5000 });
    return false;
  }
  const dataToSave = { ...result, uri };
  await ProcessLyrics(dataToSave);
  const data = JSON.stringify(dataToSave);
  $currentLyricsData.set(data);
  temporaryData = data;
  $temporaryLyricsUri.set(uri);
  setTimeout(() => {
    fetchLyrics(uri)
      .then((lyrics) => {
        ApplyLyrics(lyrics);
        toast.success("Lyrics Parsed and Applied!", {
          description: "Only for now: the song's own lyrics come back the next time it plays.",
          duration: 8000,
          action: { label: "Revert", onClick: RevertTemporaryTTML },
        });
      })
      .catch((err) => {
        toast.error("Error applying lyrics", { duration: 5000 });
        logger.error("Error applying lyrics:", err);
      });
  }, 25);
  return true;
}

/** Puts the song's own lyrics back in place of a temporary TTML. */
export function RevertTemporaryTTML() {
  const uri = $temporaryLyricsUri.get();
  if (!uri || temporaryData === null || SpotifyPlayer.GetUri() !== uri) return;
  // Clearing the data ends the temporary state (above) and makes fetchLyrics load afresh.
  $currentLyricsData.set("");
  setTimeout(() => {
    fetchLyrics(uri)
      .then(ApplyLyrics)
      .catch((err) => logger.error("Reverting lyrics failed:", err));
  }, 25);
}

/** Reads a picked, dropped or pasted file and applies it to the playing song. */
async function applyFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".ttml")) {
    toast.error("Only .ttml files are supported.", { duration: 5000 });
    return;
  }
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
}

/**
 * Opens the file picker and applies the picked .ttml to the playing song for now.
 * `doc` is the document the button lives in (Popup Lyrics has its own window).
 */
export function PickTemporaryTTML(doc: Document = document) {
  const input = doc.createElement("input");
  input.type = "file";
  input.accept = ".ttml";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    // The song at the moment of picking, not of opening the picker: it can change while the dialog is open.
    if (file) void applyFile(file);
  });
  input.click();
}

// ─── Drop or paste a .ttml onto the lyrics page ──────────────────────────────
// Only with TTML Maker Mode on, only on the lyrics page in Spotify's main window, and
// never while the Lyrics Manager's upload screen is open, which handles its own.

const ttmlFile = (files: FileList | null | undefined): File | null => {
  const file = files?.[0];
  return file && file.name.toLowerCase().endsWith(".ttml") ? file : null;
};

const onLyricsPage = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest?.("#SpicyLyricsPage");

const uploadScreenOpen = () => !!document.querySelector(".sl-ldb-upload-root");

document.addEventListener("dragover", (e) => {
  if (!$ttmlMakerMode.get() || !onLyricsPage(e.target)) return;
  // A file's name isn't readable until the drop, so any file being dragged counts here.
  if (!e.dataTransfer?.types.includes("Files")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});

document.addEventListener("drop", (e) => {
  if (!$ttmlMakerMode.get() || !onLyricsPage(e.target) || uploadScreenOpen()) return;
  const file = ttmlFile(e.dataTransfer?.files);
  if (!file) return;
  e.preventDefault();
  void applyFile(file);
});

document.addEventListener("paste", (e) => {
  if (!$ttmlMakerMode.get() || uploadScreenOpen() || !document.getElementById("SpicyLyricsPage")) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest?.("input, textarea, [contenteditable=''], [contenteditable='true']")) return;
  const file = ttmlFile(e.clipboardData?.files);
  if (!file) return;
  e.preventDefault();
  void applyFile(file);
});

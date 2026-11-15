import { toast } from "sonner";
import { SpotifyPlayer } from "../components/Global/SpotifyPlayer.ts";
import { PopupModal } from "../components/Modal.ts";
import { LyricsToTTML } from "./Lyrics/LyricsToTTML.ts";
import { LocalLyricsManager } from "./Lyrics/manager/index.ts";
import { $currentLyricsData } from "./stores.ts";

/**
 * TextFlag: a lyrics review tool that flags lines with timing or wording problems and
 * exports the notes as Markdown. It runs in a frame inside the modal and is handed
 * the playing song's TTML as a data URL in its address's fragment, so nothing is
 * uploaded anywhere.
 */
export const TEXTFLAG_URL = "https://ruytha.dev/tools/textflag";

export interface ReviewTTML {
  ttml: string;
  /** False when the TTML was written out from lyrics that arrived already parsed. */
  original: boolean;
}

/**
 * The TTML for what's showing on `uri`: the file itself when there is one (a loaded
 * or saved TTML), otherwise the loaded lyrics written out as TTML. Null when the song
 * has no lyrics loaded.
 */
export async function GetReviewTTML(uri: string): Promise<ReviewTTML | null> {
  let data: any = null;
  try {
    data = JSON.parse($currentLyricsData.get() || "null");
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || data.uri !== uri) return null;

  if (data.temporaryUpload === true && typeof data.uploadedTTML === "string") {
    return { ttml: data.uploadedTTML, original: true };
  }
  // A saved TTML is what loads for its song, so if there is one, it's on screen.
  try {
    const saved = await LocalLyricsManager.getRaw(uri);
    if (typeof saved === "string" && saved.trim()) return { ttml: saved, original: true };
  } catch {
    // The Local Lyrics DB being unavailable only means using the loaded lyrics.
  }
  const ttml = LyricsToTTML(data);
  return ttml ? { ttml, original: false } : null;
}

function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * TextFlag's address with `ttml` to load. The link goes in the fragment (`#src=`),
 * which never reaches the server: the lyrics stay on the device, and a whole song is
 * far longer than the server accepts in a query string.
 *
 * TextFlag names the review after the last path segment of the link, which a data URL
 * doesn't have, so the name rides in the data URL's own fragment (which fetching it
 * ignores). The name also keys the saved flags, so reopening the song brings them back.
 */
export function TextFlagUrl(ttml: string, name: string): string {
  const source = `data:application/xml;base64,${base64Utf8(ttml)}#/${encodeURIComponent(name)}`;
  return `${TEXTFLAG_URL}#src=${encodeURIComponent(source)}`;
}

function playingSong(): { title: string; name: string } {
  const item: any = Spicetify.Player?.data?.item;
  const title: string = item?.name ?? item?.metadata?.title ?? "Lyrics";
  const artists = (item?.artists ?? [])
    .map((artist: any) => artist?.name)
    .filter(Boolean)
    .join(", ");
  return { title, name: artists ? `${artists} - ${title}` : title };
}

// The modal writes its title into HTML.
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Opens the playing song's lyrics in TextFlag. */
export async function OpenTextFlag() {
  const uri = SpotifyPlayer.GetUri();
  const review = uri ? await GetReviewTTML(uri) : null;
  if (!review) {
    toast.error("No lyrics to review", {
      description: "Play a song with lyrics showing, then try again.",
      duration: 5000,
    });
    return;
  }

  const song = playingSong();
  const container = document.createElement("div");
  container.className = "sl-textflag";
  const loading = document.createElement("div");
  loading.className = "sl-textflag-loading";
  loading.textContent = "Loading TextFlag…";
  const frame = document.createElement("iframe");
  frame.className = "sl-textflag-frame";
  frame.title = "TextFlag";
  // Export copies the review to the clipboard.
  frame.allow = "clipboard-write";
  frame.src = TextFlagUrl(review.ttml, song.name);
  frame.addEventListener("load", () => container.classList.add("Loaded"), { once: true });
  container.append(loading, frame);

  PopupModal.display({
    // TextFlag shows its own name right below, so the modal names the song.
    title: `Reviewing ${escapeHtml(song.title)}`,
    content: container,
    isLarge: true,
    modalId: "textflag",
    // A stray click outside shouldn't throw away a note being written.
    closeOnOutsideClick: false,
  });
}

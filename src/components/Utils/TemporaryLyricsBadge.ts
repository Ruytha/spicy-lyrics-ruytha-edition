import Global from "../Global/Global.ts";
import { $temporaryLyricsUri, RevertTemporaryTTML } from "../../utils/Lyrics/manager/temporaryTTML.ts";
import { PageContainer } from "../Pages/PageView.ts";

// While a temporary TTML is showing, a badge in the lyrics area says so, with a button to
// put the song's own lyrics back, so nobody takes a test file for the real lyrics.
let badge: HTMLElement | null = null;

function ensureBadge(): HTMLElement | null {
  const host = PageContainer?.querySelector<HTMLElement>(".LyricsContainer");
  if (!host) return null;
  if (badge?.parentElement === host) return badge;

  const doc = host.ownerDocument;
  badge = doc.createElement("div");
  badge.className = "SL_TemporaryLyrics";
  badge.setAttribute("role", "status");
  const label = doc.createElement("span");
  label.className = "SL_TemporaryLyricsLabel";
  label.textContent = "Temporary lyrics";
  const revert = doc.createElement("button");
  revert.type = "button";
  revert.className = "SL_TemporaryLyricsRevert";
  revert.textContent = "Revert";
  revert.title = "Show the song's own lyrics again";
  revert.addEventListener("click", RevertTemporaryTTML);
  badge.append(label, revert);
  host.appendChild(badge);
  return badge;
}

function sync() {
  const showing = $temporaryLyricsUri.get() !== null;
  const el = showing ? ensureBadge() : badge;
  el?.classList.toggle("Visible", showing);
}

$temporaryLyricsUri.listen(sync);
// A reopened page is a new element; the badge has to be put back in it.
Global.Event.listen("page:open", () => setTimeout(sync, 0));

import "../../css/ProfileViewer.css";
import { Query } from "../../utils/API/Query.ts";

// spicylyrics.org serves this page for embedding: its CSP allows the Spotify client as a frame ancestor.
const EMBED_ORIGIN = "https://spicylyrics.org";
const SPOTIFY_URI = /^spotify:[a-z]+:[A-Za-z0-9]+$/;

let closeActive: (() => void) | null = null;
const handleCache = new Map<string, string>();

/**
 * The profile handle the embed is addressed by. The credits only carry the user id and a
 * display name, so it's looked up through the lyrics API. Null when it can't be found.
 */
async function resolveHandle(userId: string): Promise<string | null> {
  const cached = handleCache.get(userId);
  if (cached) return cached;
  try {
    const result = await Query([
      { operation: "ttmlProfile", variables: { userId, referrer: "lyricsCreditsView" } },
    ]);
    const profile = result.get("0")?.data?.profile?.data;
    const handle = profile?.username ?? profile?.user?.username;
    if (typeof handle !== "string" || !handle.trim()) return null;
    handleCache.set(userId, handle.trim());
    return handle.trim();
  } catch {
    return null;
  }
}

/**
 * Show a TTML maker/uploader's spicylyrics.org profile in a modal over the client,
 * instead of sending them to the browser. `doc` is the document the credit lives in,
 * so it also works from Popup Lyrics.
 */
export function OpenProfileViewer(userId: string, doc: Document = document) {
  closeActive?.();
  const win = doc.defaultView ?? window;

  const overlay = doc.createElement("div");
  overlay.className = "SL_ProfileViewer";
  overlay.innerHTML = `
    <div class="SL_ProfileViewer_Dialog" role="dialog" aria-modal="true" aria-label="TTML profile">
      <button type="button" class="SL_ProfileViewer_Close" aria-label="Close profile">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5.5 5.5 13 13"/><path d="m18.5 5.5-13 13"/></svg>
      </button>
      <div class="SL_ProfileViewer_Loading">Loading profile…</div>
      <iframe title="TTML profile" allow="clipboard-write" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
    </div>`;

  const iframe = overlay.querySelector("iframe")!;

  const close = () => {
    win.removeEventListener("message", onMessage);
    win.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
    if (closeActive === close) closeActive = null;
  };

  // The embed asks the client to play a track ("Listen") or to close itself.
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== EMBED_ORIGIN || event.source !== iframe.contentWindow) return;
    const events = event.data?.type === "events" ? event.data.data?.events : null;
    if (!Array.isArray(events)) return;
    for (const item of events) {
      const patches: any[] = Array.isArray(item?.patches) ? item.patches : [];
      if (item?.action === "PATCH_PLAYBACK") {
        const uri = patches[0]?.playback_uri;
        if (typeof uri === "string" && SPOTIFY_URI.test(uri)) {
          close();
          Spicetify.Player.playUri(uri);
          return;
        }
      } else if (
        item?.action === "MODIFY_APP_STATE" &&
        patches.some((patch) => patch?.ttml_profile_modal_open_state === false)
      ) {
        close();
        return;
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector(".SL_ProfileViewer_Close")!.addEventListener("click", close);
  win.addEventListener("message", onMessage);
  win.addEventListener("keydown", onKeyDown, true);

  doc.body.appendChild(overlay);
  closeActive = close;

  void resolveHandle(userId).then((handle) => {
    if (!overlay.isConnected) return;
    if (!handle) {
      overlay.querySelector(".SL_ProfileViewer_Loading")!.textContent =
        "This profile couldn't be loaded.";
      return;
    }
    iframe.addEventListener("load", () => overlay.classList.add("Loaded"), { once: true });
    iframe.src = `${EMBED_ORIGIN}/embed/${encodeURIComponent(handle)}`;
  });
}

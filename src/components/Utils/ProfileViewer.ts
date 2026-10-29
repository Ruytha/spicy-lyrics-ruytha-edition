import "../../css/ProfileViewer.css";
import { Query } from "../../utils/API/Query.ts";

// spicylyrics.org serves this page for embedding: its CSP allows the Spotify client as a frame ancestor.
const EMBED_ORIGIN = "https://spicylyrics.org";
// spicylyrics.org is retiring the embed. While it's up it shows under the card; set this to
// false once it's gone and the window is just the card.
const SHOW_EMBED = true;
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

export type ProfilePerson = { id: string; username?: string; avatar?: string };

const profileUrl = (userId: string) => `${EMBED_ORIGIN}/uid/${encodeURIComponent(userId)}`;

/**
 * The card heading the window: avatar, name, the role from the credits, and a button
 * that opens the full profile in the browser. Built from what the credits carry, so it
 * shows straight away and works without the embed.
 */
function buildCard(doc: Document, person: ProfilePerson, role: string, onOpen: () => void) {
  const card = doc.createElement("div");
  card.className = "SL_ProfileViewer_Card";

  const avatar = doc.createElement("div");
  avatar.className = "SL_ProfileViewer_Avatar";
  const name = person.username?.trim() || "Unknown";
  // Shows until the picture loads, or in its place: the name's first letter or digit.
  avatar.textContent = (name.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  if (person.avatar) {
    const img = doc.createElement("img");
    img.src = person.avatar;
    img.alt = "";
    img.onerror = () => img.remove();
    avatar.appendChild(img);
  }

  const text = doc.createElement("div");
  text.className = "SL_ProfileViewer_Text";
  const roleEl = doc.createElement("span");
  roleEl.className = "SL_ProfileViewer_Role";
  roleEl.textContent = role;
  const nameEl = doc.createElement("span");
  nameEl.className = "SL_ProfileViewer_Name";
  nameEl.textContent = `@${name}`;
  text.append(roleEl, nameEl);

  const open = doc.createElement("button");
  open.type = "button";
  open.className = "SL_ProfileViewer_Open";
  open.innerHTML = `<span>Open profile</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;
  open.title = "Opens spicylyrics.org in your browser";
  open.addEventListener("click", onOpen);

  card.append(avatar, text, open);
  return card;
}

/**
 * Show a TTML maker/uploader's profile in a window over the client: a card with who they
 * are and a link to their full profile, and spicylyrics.org's embed under it while that
 * exists. `role` is how the credits named them ("Made by"). `doc` is the document the
 * credit lives in, so it also works from Popup Lyrics.
 */
export function OpenProfileViewer(person: ProfilePerson, role: string, doc: Document = document) {
  closeActive?.();
  const win = doc.defaultView ?? window;
  const userId = person.id;

  const overlay = doc.createElement("div");
  overlay.className = SHOW_EMBED ? "SL_ProfileViewer WithEmbed" : "SL_ProfileViewer";
  overlay.innerHTML = `
    <div class="SL_ProfileViewer_Dialog" role="dialog" aria-modal="true" aria-label="TTML profile">
      <button type="button" class="SL_ProfileViewer_Close" aria-label="Close profile">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5.5 5.5 13 13"/><path d="m18.5 5.5-13 13"/></svg>
      </button>
      ${SHOW_EMBED ? `<div class="SL_ProfileViewer_Embed">
        <div class="SL_ProfileViewer_Loading">Loading profile…</div>
        <iframe title="TTML profile" allow="clipboard-write" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
      </div>` : ""}
    </div>`;

  const dialog = overlay.querySelector<HTMLElement>(".SL_ProfileViewer_Dialog")!;
  dialog.prepend(
    buildCard(doc, person, role, () => {
      win.open(profileUrl(userId), "_blank", "noopener,noreferrer");
    })
  );
  const iframe = overlay.querySelector("iframe");

  const close = () => {
    win.removeEventListener("message", onMessage);
    win.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
    if (closeActive === close) closeActive = null;
  };

  // The embed asks the client to play a track ("Listen") or to close itself.
  const onMessage = (event: MessageEvent) => {
    if (!iframe || event.origin !== EMBED_ORIGIN || event.source !== iframe.contentWindow) return;
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

  if (!iframe) return;
  void resolveHandle(userId).then((handle) => {
    if (!overlay.isConnected) return;
    // Without a handle there's no embed to show; the card alone still links the profile.
    if (!handle) {
      overlay.classList.remove("WithEmbed");
      return;
    }
    iframe.addEventListener("load", () => overlay.classList.add("Loaded"), { once: true });
    iframe.src = `${EMBED_ORIGIN}/embed/${encodeURIComponent(handle)}`;
  });
}

import "../../css/ProfileViewer.css";

// The profile lives on spicylyrics.org. The site can't be shown inside the client (it
// refuses framing and its embed is retired), so the window is a card that links to it.
const PROFILE_ORIGIN = "https://spicylyrics.org";

let closeActive: (() => void) | null = null;

export type ProfilePerson = { id: string; username?: string; avatar?: string };

const profileUrl = (userId: string) => `${PROFILE_ORIGIN}/uid/${encodeURIComponent(userId)}`;

/**
 * The card: avatar, name, the role from the credits, and a button that opens the full
 * profile in the browser. Built from what the credits carry, so it shows straight away.
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

  const hint = doc.createElement("span");
  hint.className = "SL_ProfileViewer_Hint";
  hint.textContent = "Their lyrics and stats are on spicylyrics.org.";

  card.append(avatar, text, open, hint);
  return card;
}

/**
 * Show a TTML maker/uploader's card in a window over the client. `role` is how the
 * credits named them ("Made by"). `doc` is the document the credit lives in, so it also
 * works from Popup Lyrics.
 */
export function OpenProfileViewer(person: ProfilePerson, role: string, doc: Document = document) {
  closeActive?.();
  const win = doc.defaultView ?? window;

  const overlay = doc.createElement("div");
  overlay.className = "SL_ProfileViewer";
  overlay.innerHTML = `
    <div class="SL_ProfileViewer_Dialog" role="dialog" aria-modal="true" aria-label="TTML profile">
      <button type="button" class="SL_ProfileViewer_Close" aria-label="Close profile">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5.5 5.5 13 13"/><path d="m18.5 5.5-13 13"/></svg>
      </button>
    </div>`;

  const close = () => {
    win.removeEventListener("keydown", onKeyDown, true);
    overlay.remove();
    if (closeActive === close) closeActive = null;
  };

  const dialog = overlay.querySelector<HTMLElement>(".SL_ProfileViewer_Dialog")!;
  dialog.prepend(
    buildCard(doc, person, role, () => {
      win.open(profileUrl(person.id), "_blank", "noopener,noreferrer");
      close();
    })
  );

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
  win.addEventListener("keydown", onKeyDown, true);

  doc.body.appendChild(overlay);
  closeActive = close;
}

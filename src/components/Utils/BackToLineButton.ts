import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import {
  AmllScrollBack,
  IsAmllLyricsShowing,
  IsAmllScrolledAway,
} from "../../utils/Lyrics/Applyer/AMLL.ts";
import {
  IsUserScrolledAway,
  ScrollBackToActiveLine,
} from "../../utils/Scrolling/ScrollToActiveLine.ts";
import { PageContainer } from "../Pages/PageView.ts";
import { Icons } from "../Styling/Icons.ts";

// One button per lyrics area, shown only while the reader has scrolled away from the
// playing line. Clicking it brings whichever renderer is drawing back to that line.
let button: HTMLButtonElement | null = null;
// Scrolling down leaves the playing line above, so the arrow points up then.
let scrolledDown = true;
document.addEventListener("wheel", (e) => (scrolledDown = e.deltaY > 0), {
  capture: true,
  passive: true,
});

function ensureButton(): HTMLButtonElement | null {
  const host = PageContainer?.querySelector<HTMLElement>(".LyricsContainer");
  if (!host) return null;
  if (button?.parentElement === host) return button;

  button = host.ownerDocument.createElement("button");
  button.type = "button";
  button.className = "SL_BackToLine";
  button.title = "Back to the current line (L)";
  button.setAttribute("aria-label", "Back to the current line");
  button.setAttribute("aria-keyshortcuts", "L");
  button.innerHTML = Icons.BackToLine;
  button.addEventListener("click", scrollBack);
  host.appendChild(button);
  return button;
}

function scrollBack() {
  if (IsAmllLyricsShowing()) AmllScrollBack();
  else ScrollBackToActiveLine();
}

// L jumps back too, while the lyrics page is open and nothing is being typed into.
document.addEventListener("keydown", (e) => {
  if (e.key !== "l" && e.key !== "L") return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !PageContainer?.isConnected) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return;
  scrollBack();
});

onAnimationFrame(() => {
  if (!PageContainer) return;
  const away = IsAmllLyricsShowing() ? IsAmllScrolledAway() : IsUserScrolledAway();
  const el = away ? ensureButton() : button;
  el?.classList.toggle("Visible", away);
  if (away) el?.classList.toggle("Up", scrolledDown);
});

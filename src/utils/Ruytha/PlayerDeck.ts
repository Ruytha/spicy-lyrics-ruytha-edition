import "../../css/RuythaDeck.css";
import Global from "../../components/Global/Global.ts";
import { PageContainer } from "../../components/Pages/PageView.ts";
import Fullscreen from "../../components/Utils/Fullscreen.ts";
import { IsPIP } from "../../components/Utils/PopupLyrics.ts";

// Cinema View and fullscreen draw the player's controls over the cover (NowBar.ts builds
// them inside .MediaContent). This lifts them off the artwork into a deck under the title,
// laid out like a music player: the transport, then the heart beside the volume. Compact
// mode, the popup and Canvas Stage have layouts of their own built around the overlay, so
// there the controls go back where NowBar.ts put them.

const DECK_CLASS = "SL_Deck";
const PAGE_CLASS = "SL_DeckLayout";
/** Seconds without the mouse moving before the deck fades, like a video player's. */
const IDLE_MS = 2600;

const OVERLAY = ".ContentBox .NowBar .Header .MediaBox .MediaContent";

function wantsDeck(page: HTMLElement): boolean {
  return (
    Fullscreen.IsOpen &&
    !IsPIP &&
    !page.classList.contains("CompactMode") &&
    !page.classList.contains("ForcedCompactMode") &&
    !page.classList.contains("CanvasImmersive")
  );
}

function buildDeck(doc: Document): HTMLElement {
  const deck = doc.createElement("div");
  deck.className = DECK_CLASS;
  const transport = doc.createElement("div");
  transport.className = "SL_DeckTransport";
  const lower = doc.createElement("div");
  lower.className = "SL_DeckLower";
  deck.append(transport, lower);
  return deck;
}

/** Puts the controls in the deck or back on the cover, whichever this view wants. */
export function SyncPlayerDeck() {
  const page = PageContainer;
  if (!page) return;
  watchPage(page);
  const overlay = page.querySelector<HTMLElement>(OVERLAY);
  const header = page.querySelector<HTMLElement>(".ContentBox .NowBar .Header");
  let deck = page.querySelector<HTMLElement>(`.${DECK_CLASS}`);
  const controls = page.querySelector<HTMLElement>(".NowBar .PlaybackControls");
  const heart = page.querySelector<HTMLElement>(".NowBar .Heart");
  const volume = page.querySelector<HTMLElement>(".NowBar .VolumeControl");

  lastWanted = wantsDeck(page);
  const on = lastWanted && !!header && !!overlay && !!controls;
  page.classList.toggle(PAGE_CLASS, on);

  if (on) {
    if (!deck) {
      deck = buildDeck(page.ownerDocument);
      header!.appendChild(deck);
    }
    const transport = deck.querySelector(".SL_DeckTransport")!;
    const lower = deck.querySelector(".SL_DeckLower")!;
    if (controls!.parentElement !== transport) transport.appendChild(controls!);
    if (heart && heart.parentElement !== lower) lower.prepend(heart);
    if (volume && volume.parentElement !== lower) lower.appendChild(volume);
    lower.classList.toggle("NoVolume", !volume);
    wake();
    return;
  }

  // Back onto the cover, in the order NowBar.ts appends them.
  if (overlay) {
    for (const el of [heart, controls, volume]) {
      if (el && el.parentElement !== overlay) overlay.appendChild(el);
    }
  }
  deck?.remove();
}

/** Drops the deck and whatever it holds; NowBar.ts builds the controls afresh after this. */
export function RemovePlayerDeck() {
  PageContainer?.querySelector(`.${DECK_CLASS}`)?.remove();
  PageContainer?.classList.remove(PAGE_CLASS);
}

// Compact mode and Canvas Stage come and go as page classes, so the page is watched for them.
let watched: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let lastWanted: boolean | null = null;

function watchPage(page: HTMLElement) {
  if (watched === page) return;
  observer?.disconnect();
  watched = page;
  lastWanted = null;
  observer = new MutationObserver(() => {
    const want = wantsDeck(page);
    if (want === lastWanted) return;
    lastWanted = want;
    SyncPlayerDeck();
  });
  observer.observe(page, { attributes: true, attributeFilter: ["class"] });
  page.addEventListener("pointermove", wake, { passive: true });
  page.addEventListener("pointerdown", wake, { passive: true });
}

// The deck shows while the mouse moves and fades after a moment's rest, leaving the cover.
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function wake() {
  const page = PageContainer;
  if (!page?.classList.contains(PAGE_CLASS)) return;
  page.classList.add("SL_DeckAwake");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // Not while a slider is held or the pointer rests on the deck itself.
    if (page.querySelector(`.${DECK_CLASS}:hover, .${DECK_CLASS} .Dragging`)) {
      wake();
      return;
    }
    page.classList.remove("SL_DeckAwake");
  }, IDLE_MS);
}

Global.Event.listen("page:destroy", () => {
  observer?.disconnect();
  observer = null;
  watched = null;
  clearTimeout(idleTimer);
});

// Middle-click autoscroll on the lyrics, like in a browser: press the wheel, then move the
// pointer away from where it was pressed and the lyrics scroll that way, faster the further
// it goes. A quick click keeps it going until the next click; holding and dragging stops it
// on release. Spotify's window doesn't do this by itself.
//
// Each frame sends a wheel event to the lyrics, which both renderers already treat as the
// listener scrolling (it pauses following the playing line, as a wheel does). Spicy's own
// renderer also needs its scroller moved; AMLL scrolls itself from the wheel event.
import "../../css/MiddleScroll.css";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { PageContainer } from "../Pages/PageView.ts";

// Pixels the pointer can drift from the anchor before anything scrolls.
const DEAD_ZONE = 12;
// Scroll speed per pixel of distance past the dead zone, in pixels per frame.
const SPEED = 0.12;
// A press shorter than this, without moving, is a click: scrolling stays on until the next one.
const CLICK_MS = 250;

type Session = {
  doc: Document;
  target: HTMLElement;
  scroller: HTMLElement | null;
  originY: number;
  pointerY: number;
  pressedAt: number;
  moved: boolean;
  sticky: boolean;
  marker: HTMLElement;
};

let session: Session | null = null;

function stop() {
  if (!session) return;
  session.marker.remove();
  session.doc.documentElement.classList.remove("SL_MiddleScrolling");
  session = null;
}

function start(e: MouseEvent, lyrics: HTMLElement) {
  const doc = lyrics.ownerDocument;
  const marker = doc.createElement("div");
  marker.className = "SL_MiddleScrollMarker";
  marker.setAttribute("aria-hidden", "true");
  marker.style.left = `${e.clientX}px`;
  marker.style.top = `${e.clientY}px`;
  doc.body.append(marker);
  doc.documentElement.classList.add("SL_MiddleScrolling");
  session = {
    doc,
    // AMLL listens on its player element; Spicy's renderer on its scroller, inside the container.
    target:
      lyrics.querySelector<HTMLElement>(".amll-lyric-player") ??
      lyrics.querySelector<HTMLElement>(".simplebar-content-wrapper") ??
      lyrics,
    // Spicy's renderer scrolls a SimpleBar wrapper; AMLL has none and scrolls on its own.
    scroller: lyrics.querySelector<HTMLElement>(".simplebar-content-wrapper"),
    originY: e.clientY,
    pointerY: e.clientY,
    pressedAt: performance.now(),
    moved: false,
    sticky: false,
    marker,
  };
}

function attach(doc: Document) {
  doc.addEventListener(
    "mousedown",
    (e) => {
      if (session) {
        // Any click ends an ongoing scroll, and does nothing else.
        e.preventDefault();
        e.stopPropagation();
        stop();
        return;
      }
      if (e.button !== 1) return;
      const lyrics = (e.target as HTMLElement | null)?.closest<HTMLElement>("#SpicyLyricsPage .LyricsContainer");
      if (!lyrics || lyrics.closest(".Hidden") || PageContainer?.querySelector(".ContentBox.LyricsHidden")) return;
      // Keeps Chromium from treating it as a paste or opening a link.
      e.preventDefault();
      start(e, lyrics);
    },
    true
  );
  doc.addEventListener(
    "mousemove",
    (e) => {
      if (!session || session.doc !== doc) return;
      session.pointerY = e.clientY;
      if (Math.abs(e.clientY - session.originY) > DEAD_ZONE) session.moved = true;
    },
    true
  );
  doc.addEventListener(
    "mouseup",
    (e) => {
      if (!session || e.button !== 1) return;
      const quick = performance.now() - session.pressedAt < CLICK_MS && !session.moved;
      if (quick) session.sticky = true;
      else stop();
    },
    true
  );
  // Middle-click also fires auxclick, which can open things; swallow it while scrolling.
  doc.addEventListener("auxclick", (e) => e.button === 1 && session && e.preventDefault(), true);
  doc.addEventListener("keydown", (e) => e.key === "Escape" && session && stop(), true);
  doc.addEventListener("wheel", (e) => e.isTrusted && stop(), { capture: true, passive: true });
  doc.defaultView?.addEventListener("blur", stop);
}

onAnimationFrame(() => {
  if (!session) return;
  if (!session.target.isConnected) {
    stop();
    return;
  }
  const distance = session.pointerY - session.originY;
  const past = Math.abs(distance) - DEAD_ZONE;
  session.marker.dataset.direction = past <= 0 ? "" : distance > 0 ? "down" : "up";
  if (past <= 0) return;
  const delta = Math.sign(distance) * past * SPEED;
  session.target.dispatchEvent(
    new WheelEvent("wheel", { deltaY: delta, deltaMode: 0, bubbles: true, cancelable: true })
  );
  if (session.scroller) session.scroller.scrollTop += delta;
});

attach(document);

/** Popup Lyrics lives in its own window; it gets the same handling once it opens. */
export function AttachMiddleScroll(doc: Document) {
  attach(doc);
}

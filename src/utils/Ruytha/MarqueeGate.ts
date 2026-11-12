// The title and artist scroll (the Marquee_* keyframes) runs forever, and its keyframes
// size the scroll from the text and its box, so the browser can't hand it to the
// compositor: it restyles both spans on the main thread every frame. Most titles fit,
// so the scroll moves them 0px and that work buys nothing. This turns the animation
// off for a span whose scroll would not move it, and checks again whenever the text
// or its box changes size, so a title that stops fitting starts scrolling again.
//
// The check asks the animation itself where it ends rather than repeating each
// layout's width rule: it jumps to the end, reads the offset and jumps back.
import Global from "../../components/Global/Global.ts";
import { PageContainer } from "../../components/Pages/PageView.ts";

const SPANS = [
  ".NowBar .Metadata .SongName span",
  ".NowBar .Metadata .Artists > span",
  ".SongMoreInfo .SongName span",
  ".SongMoreInfo .ArtistsNames span",
].join(", ");
const IDLE_CLASS = "SL_MarqueeIdle";

let mutations: MutationObserver | null = null;
let sizes: ResizeObserver | null = null;
let watched = new WeakSet<Element>();
const queued = new Set<HTMLElement>();
let frame = 0;

function marqueeOf(span: HTMLElement): CSSAnimation | undefined {
  return span
    .getAnimations()
    .find((a): a is CSSAnimation => a instanceof CSSAnimation && a.animationName.startsWith("Marquee_"));
}

function check(span: HTMLElement) {
  if (!span.isConnected) return;
  span.classList.remove(IDLE_CLASS);
  const animation = marqueeOf(span);
  if (!animation) return;

  const duration = Number(animation.effect?.getComputedTiming().duration) || 0;
  if (duration <= 0) return;
  const saved = animation.currentTime;
  animation.currentTime = duration * 0.95; // Inside the last keyframe: the full offset.
  const offset = new DOMMatrixReadOnly(getComputedStyle(span).transform).m41;
  animation.currentTime = saved;

  if (Math.abs(offset) < 0.5) span.classList.add(IDLE_CLASS);
}

function queue(span: HTMLElement) {
  queued.add(span);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const spans = [...queued];
    queued.clear();
    for (const span of spans) check(span);
  });
}

function watch(span: HTMLElement) {
  queue(span);
  if (watched.has(span)) return;
  watched.add(span);
  sizes?.observe(span);
  if (span.parentElement && !watched.has(span.parentElement)) {
    watched.add(span.parentElement);
    sizes?.observe(span.parentElement);
  }
}

function scan(root: ParentNode) {
  if (root instanceof HTMLElement && root.matches(SPANS)) watch(root);
  for (const span of root.querySelectorAll<HTMLElement>(SPANS)) watch(span);
}

function start(page: HTMLElement) {
  stop();
  sizes = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      if (target.matches(SPANS)) queue(target as HTMLElement);
      for (const span of target.querySelectorAll<HTMLElement>(":scope > span")) {
        if (span.matches(SPANS)) queue(span);
      }
    }
  });
  mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) scan(node);
        else if (node.parentElement?.matches(SPANS)) queue(node.parentElement);
      }
      if (record.type === "characterData" && record.target.parentElement?.matches(SPANS)) {
        queue(record.target.parentElement);
      }
    }
  });
  mutations.observe(page, { childList: true, subtree: true, characterData: true });
  scan(page);
}

function stop() {
  mutations?.disconnect();
  sizes?.disconnect();
  mutations = null;
  sizes = null;
  watched = new WeakSet();
  queued.clear();
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

Global.Event.listen("page:open", () => {
  if (PageContainer) start(PageContainer);
});
Global.Event.listen("page:destroy", stop);

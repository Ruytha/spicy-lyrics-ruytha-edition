// The Review renderer (Settings → Lyrics → Lyrics Renderer → Review): plain lines for
// checking a sync. Each word fills at an even rate from its start time to its end time
// and pops up as it starts, so both ends of its timing are easy to see. Nothing blurs,
// scales or springs, every line stays readable, and gaps between lines show as dots that
// fill across the gap. Clicking a word seeks to it; clicking elsewhere on a line seeks to
// the line. Unsynced lyrics fall back to Spicy's renderer, as with AMLL.
import { PageContainer } from "../../../components/Pages/PageView.ts";
import { SpotifyPlayer } from "../../../components/Global/SpotifyPlayer.ts";
import { onAnimationFrame } from "../../AnimationFrameLoop.ts";
import Logger from "../../Logger.ts";
import { $lyricsRenderer, $syllableMerge } from "../../stores.ts";
import { HasLyricsText, HasRenderableText, RemoveEmptyLyricsLines } from "../EmptyLines.ts";
import { SeekToLineStart, setRomanizedStatus } from "../lyrics.ts";
import { ApplySongCredits } from "./Credits/ApplyLyricsCredits.ts";
import { EmitApply } from "./OnApply.ts";
import { JoinSplitWords } from "./Utils/JoinSplitWords.ts";
import { PickDisplayText, RomanizeInPlace } from "./Utils/PickDisplayText.ts";
import { StripZeroWidth } from "./Utils/StripZeroWidth.ts";

const logger = new Logger("Review Lyrics");

/** Class on #SpicyLyricsPage while this renderer shows the lyrics. */
const PAGE_CLASS = "ReviewLyrics";
/** A gap between lines at least this long (ms) shows as dots. */
const GAP_MS = 3000;
/** A word only pops when it's reached within this long of its start, not after a seek. */
const POP_WINDOW_MS = 250;
/** Where the playing line sits, as a fraction of the lyrics area's height. */
const ALIGN = 0.35;
/** How long following the song stays paused after the listener scrolls. */
const USER_SCROLL_HOLD_MS = 4000;

interface Timed {
  el: HTMLElement;
  start: number;
  end: number;
  /** 0 not reached, 1 being sung, 2 done. */
  state: 0 | 1 | 2;
  fill: string;
}

interface Group extends Timed {
  words: Timed[];
}

interface SyllableData {
  Text: string;
  TransliteratedText?: string;
  StartTime: number;
  EndTime: number;
  IsPartOfWord?: boolean;
}

interface SyllableGroup {
  StartTime: number;
  EndTime: number;
  Syllables: SyllableData[];
}

type LyricsData = { Type: string; Content?: any[]; [key: string]: any };

export function IsReviewLyricsEnabled(): boolean {
  return $lyricsRenderer.get() === "review";
}

let root: HTMLElement | null = null;
let groups: Group[] = [];
let userScrolledAt = -Infinity;
let lastFrame = 0;
let lastFocus = -1;

export const IsReviewLyricsShowing = () => root !== null;

/** True while the listener has scrolled away from the playing line. */
export const IsReviewScrolledAway = () =>
  root !== null && performance.now() - userScrolledAt < USER_SCROLL_HOLD_MS;

export function ReviewScrollBack() {
  userScrolledAt = -Infinity;
}

export function DisposeReviewLyrics() {
  PageContainer?.classList.remove(PAGE_CLASS);
  root?.remove();
  root = null;
  groups = [];
  lastFocus = -1;
}

const toMs = (seconds: number) => Math.max(0, Math.round(seconds * 1000));

const displayText = (entry: { Text: string; TransliteratedText?: string }, romanize: boolean) =>
  StripZeroWidth(PickDisplayText(entry, RomanizeInPlace(romanize))).replace(/\s+/g, " ").trim();

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function timed(node: HTMLElement, start: number, end: number): Timed {
  return { el: node, start, end: Math.max(start, end), state: 0, fill: "" };
}

/** A row of words: a syllable that ends a word is followed by a space. */
function buildWords(row: HTMLElement, syllables: SyllableData[], romanize: boolean, into: Timed[]) {
  const merge = $syllableMerge.get();
  const parts = (merge === "off" ? syllables : JoinSplitWords(syllables, merge)).filter(HasRenderableText);
  parts.forEach((syllable, i) => {
    const text = displayText(syllable, romanize);
    if (!text) return;
    const word = el("span", "SLR_Word", text);
    const entry = timed(word, toMs(syllable.StartTime), toMs(syllable.EndTime));
    word.dataset.start = String(entry.start);
    row.appendChild(word);
    into.push(entry);
    if (!syllable.IsPartOfWord && i < parts.length - 1) row.appendChild(document.createTextNode(" "));
  });
}

function buildSyllableGroups(content: any[], romanize: boolean): Group[] {
  const out: Group[] = [];
  for (const entry of RemoveEmptyLyricsLines(content)) {
    const node = el("div", "SLR_Line");
    if (entry.OppositeAligned) node.classList.add("Opposite");
    const words: Timed[] = [];
    const lead = el("div", "SLR_Lead");
    buildWords(lead, (entry.Lead as SyllableGroup).Syllables, romanize, words);
    if (lead.childElementCount) node.appendChild(lead);
    for (const group of (entry.Background ?? []) as SyllableGroup[]) {
      const row = el("div", "SLR_Background");
      buildWords(row, group.Syllables, romanize, words);
      if (row.childElementCount) node.appendChild(row);
    }
    if (words.length === 0) continue;
    const start = Math.min(...words.map((w) => w.start));
    const end = Math.max(...words.map((w) => w.end));
    out.push({ ...timed(node, start, end), words });
  }
  return out;
}

// A line-synced line fills as one piece. It's inline, so the fill runs on across a
// line that wraps, in reading order.
function buildLineGroups(content: any[], romanize: boolean): Group[] {
  const out: Group[] = [];
  for (const entry of content) {
    const text = displayText(entry, romanize);
    if (!HasLyricsText(text)) continue;
    const node = el("div", "SLR_Line Synced");
    if (entry.OppositeAligned) node.classList.add("Opposite");
    const lead = el("div", "SLR_Lead");
    const span = el("span", "SLR_Word SLR_Whole", text);
    lead.appendChild(span);
    node.appendChild(lead);
    const start = toMs(entry.StartTime);
    const end = toMs(entry.EndTime);
    out.push({ ...timed(node, start, end), words: [timed(span, start, end)] });
  }
  return out;
}

/** Dots between lines that are far apart, filling across the gap. */
function gapBetween(prev: Group | undefined, next: Group): Group | null {
  const start = prev ? prev.end : 0;
  if (next.start - start < GAP_MS) return null;
  const node = el("div", "SLR_Line SLR_Gap");
  if (next.el.classList.contains("Opposite")) node.classList.add("Opposite");
  const dots = el("span", "SLR_Word SLR_Dots", "• • •");
  node.appendChild(dots);
  return { ...timed(node, start, next.start), words: [timed(dots, start, next.start)] };
}

const fillOf = (t: Timed, position: number): string => {
  if (position >= t.end) return "1";
  if (position <= t.start) return "0";
  return ((position - t.start) / (t.end - t.start)).toFixed(3);
};

const stateOf = (t: Timed, position: number): 0 | 1 | 2 =>
  position < t.start ? 0 : position >= t.end ? 2 : 1;

function setState(t: Timed, state: 0 | 1 | 2) {
  if (t.state === state) return;
  t.state = state;
  t.el.classList.toggle("Active", state === 1);
  t.el.classList.toggle("Sung", state === 2);
}

function setFill(t: Timed, fill: string) {
  if (t.fill === fill) return;
  t.fill = fill;
  t.el.style.setProperty("--SLR-Fill", fill);
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function pop(word: HTMLElement) {
  if (reducedMotion.matches) return;
  word.getAnimations().forEach((animation) => animation.cancel());
  word.animate(
    [
      { transform: "translateY(0.04em) scale(0.97)" },
      { transform: "translateY(-0.2em) scale(1.09)", offset: 0.3 },
      { transform: "none" },
    ],
    { duration: 460, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" }
  );
}

function onUserScroll() {
  userScrolledAt = performance.now();
}

/**
 * Render synced lyrics with the Review renderer. Returns false when it can't (unsynced
 * lyrics, or nothing to show), so the caller uses Spicy's own renderer instead.
 */
export function ApplyReviewLyrics(data: LyricsData, romanize: boolean): boolean {
  DisposeReviewLyrics();
  if (data.Type !== "Syllable" && data.Type !== "Line") return false;
  const host = PageContainer?.querySelector<HTMLElement>(".LyricsContainer .LyricsContent");
  if (!host) return false;

  let built: Group[];
  try {
    built =
      data.Type === "Syllable"
        ? buildSyllableGroups(data.Content ?? [], romanize)
        : buildLineGroups(data.Content ?? [], romanize);
  } catch (err) {
    logger.warn("Lyrics couldn't be laid out; using the default renderer", err);
    return false;
  }
  if (built.length === 0) return false;

  const scroller = el("div", "SLR_Player");
  scroller.appendChild(el("div", "SLR_Pad"));
  const all: Group[] = [];
  built.forEach((group, i) => {
    const gap = gapBetween(built[i - 1], group);
    if (gap) {
      scroller.appendChild(gap.el);
      all.push(gap);
    }
    scroller.appendChild(group.el);
    all.push(group);
  });
  const credits = el("div", "SLR_Credits");
  scroller.appendChild(credits);
  ApplySongCredits(data, credits);
  scroller.appendChild(el("div", "SLR_Pad"));

  scroller.addEventListener("click", (e) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const target = e.target as HTMLElement;
    const word = target.closest<HTMLElement>(".SLR_Word[data-start]");
    const line = target.closest<HTMLElement>(".SLR_Line");
    const group = line && all.find((g) => g.el === line);
    if (!group) return;
    ReviewScrollBack();
    SeekToLineStart(word ? Number(word.dataset.start) : group.start);
  });
  scroller.addEventListener("wheel", onUserScroll, { passive: true });
  scroller.addEventListener("touchmove", onUserScroll, { passive: true });
  scroller.addEventListener("keydown", onUserScroll);

  host.appendChild(scroller);
  PageContainer?.classList.add(PAGE_CLASS);
  root = scroller;
  groups = all;
  userScrolledAt = -Infinity;
  lastFrame = performance.now();
  // Lay out the current state at once, with no pops and no glide.
  update(SpotifyPlayer.GetPosition(), false, true);

  EmitApply(data.Type, data.Content);
  setRomanizedStatus(romanize);
  return true;
}

/** The group to keep in place: the first one being sung, else the next to come. */
function focusIndex(position: number): number {
  let next = -1;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.el.classList.contains("SLR_Gap")) {
      if (position >= g.start && position < g.end) return i;
      continue;
    }
    if (position >= g.start && position < g.end) return i;
    if (next === -1 && g.start > position) next = i;
  }
  return next === -1 ? groups.length - 1 : next;
}

function update(position: number, playing: boolean, jump: boolean) {
  for (const group of groups) {
    setState(group, stateOf(group, position));
    for (const word of group.words) {
      const state = stateOf(word, position);
      if (state !== 0 && word.state === 0 && playing && position - word.start < POP_WINDOW_MS && !group.el.classList.contains("SLR_Gap")) {
        pop(word.el);
      }
      setState(word, state);
      setFill(word, fillOf(word, position));
    }
  }

  if (!root) return;
  const focus = focusIndex(position);
  if (focus !== lastFocus) {
    root.querySelector(".SLR_Line.Focus")?.classList.remove("Focus");
    groups[focus]?.el.classList.add("Focus");
  }
  const changed = focus !== lastFocus;
  lastFocus = focus;
  if (IsReviewScrolledAway() || !groups[focus]) return;
  const target = Math.max(0, groups[focus].el.offsetTop - root.clientHeight * ALIGN);
  if (jump || (changed && Math.abs(target - root.scrollTop) > root.clientHeight * 2)) {
    root.scrollTop = target;
    return;
  }
  const dt = Math.min(64, performance.now() - lastFrame);
  const step = (target - root.scrollTop) * (1 - Math.exp(-dt / 110));
  if (Math.abs(target - root.scrollTop) > 0.5) root.scrollTop += step;
}

onAnimationFrame(() => {
  if (!root) return;
  if (!root.isConnected) {
    DisposeReviewLyrics();
    return;
  }
  update(SpotifyPlayer.GetPosition(), SpotifyPlayer.IsPlaying, false);
  lastFrame = performance.now();
});

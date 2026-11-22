// Flag Lyrics: select words on the lyrics page, flag them with a type and a note, and
// copy the whole review as Markdown. Flags are kept per song (ReviewFlags.ts).
//
// The lyrics list is virtualized, so only the lines on screen are in the DOM. A flag
// therefore points at words by position in LyricsObject (line index, word index), whose
// elements live on while scrolled away; highlights are classes on those elements.
import { toast } from "sonner";
import Global from "../../components/Global/Global.ts";
import { SpotifyPlayer } from "../../components/Global/SpotifyPlayer.ts";
import { PageContainer } from "../../components/Pages/PageView.ts";
import { LyricsObject, SeekToLineStart } from "../Lyrics/lyrics.ts";
import { $lyricsRenderer, persistAtom } from "../stores.ts";
import {
  FLAG_KINDS,
  FlagStart,
  LoadReview,
  NewFlagId,
  ReviewToMarkdown,
  SaveReview,
  SortFlags,
  SpansOverlap,
  type FlagExcerpt,
  type FlagKind,
  type FlagSpan,
  type ReviewFlag,
  type SongReview,
  type TimingDirection,
  type TimingPart,
} from "./ReviewFlags.ts";

export const $flagLyrics = persistAtom<boolean>("flagLyrics", false);

const PAGE_CLASS = "SL_Reviewing";
const FLAGGED_CLASS = "SL_Flagged";

const FLAG_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 14.5V2.2m0 .3c3-1.6 5.2 1.4 9 0v6.6c-3.8 1.4-6-1.6-9 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ─── Lines and words ─────────────────────────────────────────────────────────

interface ReviewLine {
  el: HTMLElement;
  /** Milliseconds; absent for unsynced lyrics. */
  time?: number;
  background: boolean;
  /** The flaggable pieces: words for word-synced lyrics, the whole line otherwise. */
  units: HTMLElement[];
}

interface LinesIndex {
  source: unknown[];
  sourceLength: number;
  lines: ReviewLine[];
  unitAt: WeakMap<Element, [number, number]>;
}

let index: LinesIndex | null = null;

const isInterlude = (el: HTMLElement) => el.classList.contains("musical-line");

function sourceLines(): unknown[] {
  const types = LyricsObject.Types;
  if (types.Syllable.Lines.length) return types.Syllable.Lines;
  if (types.Line.Lines.length) return types.Line.Lines;
  return types.Static.Lines;
}

function buildLines(): ReviewLine[] {
  const types = LyricsObject.Types;
  if (types.Syllable.Lines.length) {
    return types.Syllable.Lines.filter((line) => !line.DotLine && !isInterlude(line.HTMLElement)).map((line) => {
      const words = (line.Syllables?.Lead ?? []).filter((word) => !word.Dot);
      return {
        el: line.HTMLElement,
        time: words[0]?.StartTime ?? line.StartTime,
        background: !!line.BGLine,
        units: words.map((word) => word.HTMLElement),
      };
    });
  }
  if (types.Line.Lines.length) {
    return types.Line.Lines.filter((line) => !isInterlude(line.HTMLElement)).map((line) => ({
      el: line.HTMLElement,
      time: line.StartTime,
      background: false,
      units: [line.HTMLElement],
    }));
  }
  return types.Static.Lines.map((line) => ({
    el: line.HTMLElement,
    background: false,
    units: [line.HTMLElement],
  }));
}

/** The lines as they are now, rebuilt whenever the lyrics are. */
function currentIndex(): LinesIndex {
  const source = sourceLines();
  if (index && index.source === source && index.sourceLength === source.length) return index;
  const lines = buildLines();
  const unitAt = new WeakMap<Element, [number, number]>();
  lines.forEach((line, li) => line.units.forEach((unit, ui) => unitAt.set(unit, [li, ui])));
  index = { source, sourceLength: source.length, lines, unitAt };
  return index;
}

/** A unit's own text: a whole line leaves out the translation or romanization under it. */
function unitText(line: ReviewLine, unit: HTMLElement): string {
  if (line.units.length === 1 && unit === line.el) {
    return [...unit.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
  }
  return (unit.textContent ?? "").trim();
}

/** Words `from`..`to` of a line as text, spaced the way the line shows them. */
function joinUnits(line: ReviewLine, from: number, to: number): string {
  let text = "";
  for (let i = from; i <= to && i < line.units.length; i++) {
    text += unitText(line, line.units[i]);
    const joinsNext = line.units[i].classList.contains("PartOfWord");
    if (i < to && !joinsNext) text += " ";
  }
  return text;
}

function excerptOf(span: FlagSpan): FlagExcerpt | null {
  const line = currentIndex().lines[span.line];
  if (!line) return null;
  const last = line.units.length - 1;
  const gapBefore = span.from > 0 && !line.units[span.from - 1].classList.contains("PartOfWord") ? " " : "";
  const gapAfter = span.to < last && !line.units[span.to].classList.contains("PartOfWord") ? " " : "";
  return {
    line: span.line,
    time: line.time,
    background: line.background,
    before: span.from > 0 ? joinUnits(line, 0, span.from - 1) + gapBefore : "",
    text: joinUnits(line, span.from, span.to),
    after: span.to < last ? gapAfter + joinUnits(line, span.to + 1, last) : "",
  };
}

// ─── The song's flags ────────────────────────────────────────────────────────

let reviewUri: string | null = null;
let review: SongReview = { name: "", flags: [] };

function songName(): string {
  const item: any = Spicetify.Player?.data?.item;
  const title: string = item?.name ?? item?.metadata?.title ?? "";
  const artists = (item?.artists ?? []).map((a: any) => a?.name).filter(Boolean).join(", ");
  return artists && title ? `${artists} - ${title}` : title || artists;
}

function loadSong() {
  const uri = SpotifyPlayer.GetUri() ?? null;
  if (uri === reviewUri) return;
  reviewUri = uri;
  review = (uri && LoadReview(uri)) || { name: songName(), flags: [] };
}

function save() {
  if (!reviewUri) return;
  review.name = songName() || review.name;
  SaveReview(reviewUri, review);
  paintHighlights();
  renderDock();
}

// ─── Highlights ──────────────────────────────────────────────────────────────

let painted = new Set<HTMLElement>();
const flagOfUnit = new WeakMap<Element, string>();

function paintHighlights() {
  for (const el of painted) el.classList.remove(FLAGGED_CLASS);
  painted = new Set();
  if (!active()) return;
  const { lines } = currentIndex();
  for (const flag of review.flags) {
    for (const span of flag.spans) {
      const line = lines[span.line];
      if (!line) continue;
      for (let i = span.from; i <= span.to && i < line.units.length; i++) {
        const unit = line.units[i];
        unit.classList.add(FLAGGED_CLASS);
        flagOfUnit.set(unit, flag.id);
        painted.add(unit);
      }
    }
  }
}

// ─── Selection → pill ────────────────────────────────────────────────────────

let pill: HTMLButtonElement | null = null;
let pendingSpans: FlagSpan[] | null = null;
let pendingRect: DOMRect | null = null;

function lyricsContent(): HTMLElement | null {
  return PageContainer?.querySelector<HTMLElement>(".LyricsContainer .LyricsContent") ?? null;
}

/** The words the selection covers, line by line. */
function selectedSpans(): { spans: FlagSpan[]; rect: DOMRect } | null {
  const selection = getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const content = lyricsContent();
  if (!content || !content.contains(range.commonAncestorContainer)) return null;

  const spans: FlagSpan[] = [];
  const unitRange = document.createRange();
  currentIndex().lines.forEach((line, li) => {
    if (!line.el.isConnected || !range.intersectsNode(line.el)) return;
    let from = -1;
    let to = -1;
    line.units.forEach((unit, ui) => {
      if (!unit.isConnected) return;
      unitRange.selectNodeContents(unit);
      // The selection ends after the word starts, and starts before it ends.
      const overlaps =
        range.compareBoundaryPoints(Range.START_TO_END, unitRange) > 0 &&
        range.compareBoundaryPoints(Range.END_TO_START, unitRange) < 0;
      if (overlaps) {
        if (from < 0) from = ui;
        to = ui;
      }
    });
    if (from >= 0) spans.push({ line: li, from, to });
  });
  if (!spans.length) return null;
  return { spans, rect: range.getBoundingClientRect() };
}

function pageRect(): DOMRect {
  return (PageContainer ?? document.body).getBoundingClientRect();
}

/** Places `el` centred over `rect` (or under it, when there's no room above). */
function placeNear(el: HTMLElement, rect: DOMRect, gap = 10) {
  const page = pageRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const left = Math.min(Math.max(8, rect.left - page.left + rect.width / 2 - width / 2), page.width - width - 8);
  let top = rect.top - page.top - height - gap;
  if (top < 8) top = rect.bottom - page.top + gap;
  top = Math.min(top, page.height - height - 8);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(Math.max(8, top))}px`;
}

let pillFrame = 0;

function hidePill() {
  pill?.remove();
  pill = null;
  if (pillFrame) cancelAnimationFrame(pillFrame);
  pillFrame = 0;
}

/** The lyrics keep scrolling while a song plays, so the pill follows its selection. */
function followSelection() {
  pillFrame = requestAnimationFrame(() => {
    pillFrame = 0;
    if (!pill) return;
    const selection = getSelection();
    const rect = selection && selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    // A selection scrolled out of the list has no box left to point at.
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hidePill();
      return;
    }
    pendingRect = rect;
    placeNear(pill, rect);
    followSelection();
  });
}

function showPill(spans: FlagSpan[], rect: DOMRect) {
  if (!PageContainer) return;
  pendingSpans = spans;
  pendingRect = rect;
  if (!pill) {
    pill = document.createElement("button");
    pill.type = "button";
    pill.className = "SL_FlagPill";
    pill.innerHTML = `${FLAG_ICON}<span>Flag</span>`;
    pill.title = "Flag these lyrics (Shift-click to flag without a note)";
    // Keep the selection: a press on the button would otherwise clear it first.
    pill.addEventListener("mousedown", (event) => event.preventDefault());
    pill.addEventListener("click", (event) => {
      event.stopPropagation();
      const spans = pendingSpans;
      const rect = pendingRect;
      hidePill();
      if (!spans || !rect) return;
      const existing = review.flags.find((flag) => SpansOverlap(flag.spans, spans));
      if (event.shiftKey && !existing) {
        addFlag(spans, { kind: null, note: "" });
        getSelection()?.removeAllRanges();
        return;
      }
      openEditor(existing ?? null, spans, rect);
    });
    PageContainer.appendChild(pill);
  }
  placeNear(pill, rect);
  if (!pillFrame) followSelection();
}

function onPointerUp() {
  if (!active()) return;
  // Checked a frame later: the click that opens the editor lands after this mouseup.
  requestAnimationFrame(() => {
    if (editor) return;
    const picked = selectedSpans();
    if (picked) showPill(picked.spans, picked.rect);
    else hidePill();
  });
}

function onSelectionChange() {
  if (!pill) return;
  const selection = getSelection();
  if (!selection || selection.isCollapsed) hidePill();
}

// ─── Editor ──────────────────────────────────────────────────────────────────

let editor: HTMLElement | null = null;

function addFlag(spans: FlagSpan[], fields: Pick<ReviewFlag, "kind" | "note" | "timing">) {
  const excerpts = spans.map(excerptOf).filter((e): e is FlagExcerpt => !!e);
  review.flags.push({ id: NewFlagId(), spans, excerpts, ...fields });
  save();
}

function closeEditor() {
  editor?.remove();
  editor = null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function segmented<T extends string>(
  label: string,
  options: readonly { value: T; label: string }[],
  value: T,
  onChange: (value: T) => void
) {
  const group = el("div", "SL_FlagSegmented");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", label);
  const buttons = options.map((option) => {
    const button = el("button", undefined, option.label);
    button.type = "button";
    button.setAttribute("role", "radio");
    button.addEventListener("click", () => {
      onChange(option.value);
      for (const [i, b] of buttons.entries()) b.setAttribute("aria-checked", String(options[i].value === option.value));
    });
    button.setAttribute("aria-checked", String(option.value === value));
    group.appendChild(button);
    return button;
  });
  return group;
}

function openEditor(flag: ReviewFlag | null, spans: FlagSpan[], rect: DOMRect) {
  if (!PageContainer) return;
  closeEditor();
  hidePill();

  let kind: FlagKind | null = flag?.kind ?? null;
  let part: TimingPart = flag?.timing?.part ?? "start";
  let direction: TimingDirection = flag?.timing?.direction ?? "early";
  const flagSpans = flag?.spans ?? spans;

  const box = el("div", "SL_FlagEditor");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", flag ? "Edit flag" : "New flag");

  const quote = el("div", "SL_FlagQuote");
  const excerpts = flag?.excerpts ?? flagSpans.map(excerptOf).filter((e): e is FlagExcerpt => !!e);
  quote.textContent = excerpts.map((e) => e.text).join(" / ");
  box.appendChild(quote);

  const kinds = el("div", "SL_FlagKinds");
  kinds.setAttribute("role", "group");
  kinds.setAttribute("aria-label", "What's wrong?");
  const timing = el("div", "SL_FlagTiming");
  const syncKinds = () => {
    for (const chip of kinds.querySelectorAll<HTMLButtonElement>("button")) {
      chip.setAttribute("aria-pressed", String(chip.dataset.kind === kind));
    }
    timing.hidden = kind !== "timing";
  };
  for (const option of FLAG_KINDS) {
    const chip = el("button", undefined, option.label);
    chip.type = "button";
    chip.dataset.kind = option.kind;
    chip.addEventListener("click", () => {
      kind = kind === option.kind ? null : option.kind;
      syncKinds();
    });
    kinds.appendChild(chip);
  }
  box.appendChild(kinds);

  timing.append(
    segmented(
      "Which part",
      [
        { value: "start", label: "Starts" },
        { value: "end", label: "Ends" },
        { value: "line", label: "Whole" },
      ] as const,
      part,
      (value) => (part = value)
    ),
    segmented(
      "Which way",
      [
        { value: "early", label: "Too early" },
        { value: "late", label: "Too late" },
      ] as const,
      direction,
      (value) => (direction = value)
    )
  );
  box.appendChild(timing);
  syncKinds();

  const note = el("textarea", "SL_FlagNote");
  note.placeholder = "Add a note (optional)";
  note.rows = 3;
  note.value = flag?.note ?? "";
  box.appendChild(note);

  const actions = el("div", "SL_FlagActions");
  const commit = () => {
    const fields = {
      kind,
      note: note.value,
      timing: kind === "timing" ? { part, direction } : undefined,
    };
    if (flag) Object.assign(flag, fields);
    if (flag) save();
    else addFlag(flagSpans, fields);
    closeEditor();
    getSelection()?.removeAllRanges();
  };
  if (flag) {
    const remove = el("button", "SL_FlagButton Danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => {
      review.flags = review.flags.filter((f) => f.id !== flag.id);
      save();
      closeEditor();
    });
    actions.appendChild(remove);
  }
  actions.appendChild(el("span", "SL_FlagSpacer"));
  const cancel = el("button", "SL_FlagButton", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", closeEditor);
  const saveButton = el("button", "SL_FlagButton Primary", flag ? "Save" : "Flag");
  saveButton.type = "button";
  saveButton.addEventListener("click", commit);
  actions.append(cancel, saveButton);
  box.appendChild(actions);

  // Typing a note mustn't reach Spotify's shortcuts (space would pause).
  box.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") closeEditor();
    else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) commit();
  });
  box.addEventListener("keyup", (event) => event.stopPropagation());
  box.addEventListener("keypress", (event) => event.stopPropagation());
  box.addEventListener("mousedown", (event) => event.stopPropagation());
  box.addEventListener("click", (event) => event.stopPropagation());

  PageContainer.appendChild(box);
  editor = box;
  placeNear(box, rect, 12);
  note.focus({ preventScroll: true });
}

/** A click on a flagged word opens its flag instead of seeking. */
function onClickCapture(event: MouseEvent) {
  if (!active()) return;
  const target = event.target as HTMLElement | null;
  if (editor && target && !editor.contains(target) && !target.closest(".SL_FlagPill")) {
    closeEditor();
  }
  const selection = getSelection();
  if (selection && !selection.isCollapsed) return;
  const unit = target?.closest<HTMLElement>(`.${FLAGGED_CLASS}`);
  if (!unit) return;
  const flag = review.flags.find((f) => f.id === flagOfUnit.get(unit));
  if (!flag) return;
  event.preventDefault();
  event.stopPropagation();
  openEditor(flag, flag.spans, unit.getBoundingClientRect());
}

// ─── Dock ────────────────────────────────────────────────────────────────────

let dock: HTMLElement | null = null;

function iconButton(label: string, svg: string, onClick: () => void) {
  const button = el("button", "SL_ReviewDockIcon");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = svg;
  button.addEventListener("click", onClick);
  return button;
}

const CHEVRON = (d: string) =>
  `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Seeks to the next (or previous) flag from where the song is now. */
function jump(step: 1 | -1) {
  const flags = SortFlags(review.flags);
  if (!flags.length) return;
  const now = SpotifyPlayer.GetPosition?.() ?? 0;
  const timed = flags.filter((flag) => FlagStart(flag).time !== undefined);
  if (timed.length) {
    const times = timed.map((flag) => FlagStart(flag).time as number);
    const target =
      step === 1
        ? (times.find((t) => t > now + 250) ?? times[0])
        : ([...times].reverse().find((t) => t < now - 1500) ?? times[times.length - 1]);
    SeekToLineStart(target);
    return;
  }
  const line = currentIndex().lines[FlagStart(step === 1 ? flags[0] : flags[flags.length - 1]).line];
  line?.el.scrollIntoView({ block: "center", behavior: "smooth" });
}

async function copyReview() {
  if (!review.flags.length) {
    toast("Nothing to copy yet", { description: "Select some lyrics and flag them first." });
    return;
  }
  review.name = songName() || review.name;
  const markdown = ReviewToMarkdown(review);
  try {
    await navigator.clipboard.writeText(markdown);
    toast.success(`Copied ${review.flags.length} flag${review.flags.length === 1 ? "" : "s"} as Markdown`);
  } catch {
    toast.error("Couldn't copy the review");
  }
}

function renderDock() {
  if (!active()) {
    dock?.remove();
    dock = null;
    return;
  }
  const container = PageContainer?.querySelector<HTMLElement>(".ContentBox .LyricsContainer");
  if (!container) return;
  if (!dock || dock.parentElement !== container) {
    dock?.remove();
    dock = el("div", "SL_ReviewDock");
    dock.setAttribute("role", "toolbar");
    dock.setAttribute("aria-label", "Lyrics review");
    container.appendChild(dock);
  }
  dock.replaceChildren();

  const label = el("span", "SL_ReviewDockLabel");
  label.innerHTML = FLAG_ICON;
  const count = review.flags.length;
  // Flags mark Spicy's own word elements, which the other renderers don't build.
  const amll = $lyricsRenderer.get() !== "spicy";
  label.append(
    el(
      "span",
      undefined,
      amll ? "Flagging works with Spicy's renderer" : count ? `${count} flag${count === 1 ? "" : "s"}` : "Select lyrics to flag them"
    )
  );
  dock.appendChild(label);

  if (count && !amll) {
    dock.append(
      iconButton("Previous flag", CHEVRON("M10 3.5 5.5 8l4.5 4.5"), () => jump(-1)),
      iconButton("Next flag", CHEVRON("M6 3.5 10.5 8 6 12.5"), () => jump(1))
    );
    const copy = el("button", "SL_ReviewDockCopy", "Copy review");
    copy.type = "button";
    copy.addEventListener("click", () => void copyReview());
    dock.appendChild(copy);
  }
  dock.appendChild(iconButton("Stop flagging", CHEVRON("M4 4l8 8M12 4l-8 8"), () => $flagLyrics.set(false)));
}

// ─── On and off ──────────────────────────────────────────────────────────────

function active(): boolean {
  return $flagLyrics.get() && !!PageContainer?.isConnected;
}

let observer: MutationObserver | null = null;
let refreshFrame = 0;

/** After the lyrics are rebuilt (a new song, a setting change), draw the flags on them. */
function scheduleRefresh() {
  if (refreshFrame) return;
  refreshFrame = requestAnimationFrame(() => {
    refreshFrame = 0;
    if (!active()) return;
    const before = index;
    const now = currentIndex();
    if (before !== now) {
      loadSong();
      closeEditor();
      hidePill();
      paintHighlights();
      renderDock();
    } else if (!dock?.isConnected) {
      renderDock();
    }
  });
}

function start() {
  if (!PageContainer || !$flagLyrics.get()) return;
  PageContainer.classList.add(PAGE_CLASS);
  index = null;
  loadSong();
  observer?.disconnect();
  observer = new MutationObserver(scheduleRefresh);
  observer.observe(PageContainer, { childList: true, subtree: true });
  document.addEventListener("mouseup", onPointerUp);
  document.addEventListener("keyup", onPointerUp);
  document.addEventListener("selectionchange", onSelectionChange);
  PageContainer.addEventListener("click", onClickCapture, true);
  paintHighlights();
  renderDock();
}

function stop() {
  observer?.disconnect();
  observer = null;
  if (refreshFrame) cancelAnimationFrame(refreshFrame);
  refreshFrame = 0;
  document.removeEventListener("mouseup", onPointerUp);
  document.removeEventListener("keyup", onPointerUp);
  document.removeEventListener("selectionchange", onSelectionChange);
  PageContainer?.removeEventListener("click", onClickCapture, true);
  PageContainer?.classList.remove(PAGE_CLASS);
  closeEditor();
  hidePill();
  for (const unit of painted) unit.classList.remove(FLAGGED_CLASS);
  painted = new Set();
  dock?.remove();
  dock = null;
}

Global.Event.listen("page:open", () => start());
Global.Event.listen("page:destroy", stop);
$flagLyrics.listen((on) => (on ? start() : stop()));
$lyricsRenderer.listen(() => {
  if (active()) renderDock();
});

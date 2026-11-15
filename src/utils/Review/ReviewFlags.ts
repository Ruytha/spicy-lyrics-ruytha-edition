/**
 * Lyrics review flags: notes pinned to words of a song's lyrics, kept per song and
 * exported as Markdown to send to whoever made the sync.
 *
 * This file holds the data and has no DOM or Spicetify dependency beyond storage,
 * so it can be tested on its own. ReviewMode.ts draws it on the lyrics page.
 */

export type FlagKind = "timing" | "spelling" | "words" | "lineBreak" | "split" | "other";
export type TimingPart = "line" | "start" | "end";
export type TimingDirection = "early" | "late";

export const FLAG_KINDS: readonly { kind: FlagKind; label: string }[] = [
  { kind: "timing", label: "Timing" },
  { kind: "spelling", label: "Spelling" },
  { kind: "words", label: "Wrong words" },
  { kind: "lineBreak", label: "Line break" },
  { kind: "split", label: "Syllable split" },
  { kind: "other", label: "Other" },
];

/** A run of words in one line: indices into that line's words, inclusive. */
export interface FlagSpan {
  /** The line's index among the song's lyric lines (background lines count, interludes don't). */
  line: number;
  from: number;
  to: number;
}

/** A flagged line as it read when the flag was raised, for the export. */
export interface FlagExcerpt {
  line: number;
  /** Where the line starts, in milliseconds; absent for unsynced lyrics. */
  time?: number;
  background: boolean;
  before: string;
  text: string;
  after: string;
}

export interface ReviewFlag {
  id: string;
  spans: FlagSpan[];
  excerpts: FlagExcerpt[];
  kind: FlagKind | null;
  timing?: { part: TimingPart; direction: TimingDirection };
  note: string;
}

export interface SongReview {
  /** "Artist - Title", for the export's heading. */
  name: string;
  flags: ReviewFlag[];
}

const STORAGE_PREFIX = "SL:reviewFlags:";

/** localStorage, through Spicetify's wrapper when it's there. */
const storage = {
  get(key: string): string | null {
    const spicetify = (globalThis as any).Spicetify?.LocalStorage;
    return spicetify ? spicetify.get(key) : (globalThis as any).localStorage?.getItem(key) ?? null;
  },
  set(key: string, value: string) {
    const spicetify = (globalThis as any).Spicetify?.LocalStorage;
    if (spicetify) spicetify.set(key, value);
    else (globalThis as any).localStorage?.setItem(key, value);
  },
  remove(key: string) {
    const spicetify = (globalThis as any).Spicetify?.LocalStorage;
    if (spicetify) spicetify.remove(key);
    else (globalThis as any).localStorage?.removeItem(key);
  },
};

export function LoadReview(uri: string): SongReview | null {
  try {
    const raw = storage.get(STORAGE_PREFIX + uri);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.flags)) return null;
    return { name: typeof parsed.name === "string" ? parsed.name : "", flags: parsed.flags };
  } catch {
    return null;
  }
}

/** Saves `review` for `uri`, or forgets it once it has no flags. */
export function SaveReview(uri: string, review: SongReview) {
  const key = STORAGE_PREFIX + uri;
  try {
    if (review.flags.length === 0) storage.remove(key);
    else storage.set(key, JSON.stringify(review));
  } catch {
    // Full or unavailable storage: the flags stay for this session.
  }
}

/** The flag's heading: its type, with the timing spelled out ("Starts too early"). */
export function FlagLabel(flag: Pick<ReviewFlag, "kind" | "timing">): string {
  if (flag.kind === "timing" && flag.timing) {
    const late = flag.timing.direction === "late";
    if (flag.timing.part === "start") return late ? "Starts too late" : "Starts too early";
    if (flag.timing.part === "end") return late ? "Ends too late" : "Ends too early";
    return late ? "Too late" : "Too early";
  }
  return FLAG_KINDS.find((k) => k.kind === flag.kind)?.label ?? "Flag";
}

/** Milliseconds as m:ss.mmm. */
export function FormatFlagTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60000);
  return `${minutes}:${((total % 60000) / 1000).toFixed(3).padStart(6, "0")}`;
}

/** The earliest point a flag touches, for ordering and for jumping to it. */
export function FlagStart(flag: ReviewFlag): { line: number; time?: number } {
  const first = [...flag.excerpts].sort((a, b) => a.line - b.line)[0];
  return { line: first?.line ?? flag.spans[0]?.line ?? 0, time: first?.time };
}

export function SortFlags(flags: ReviewFlag[]): ReviewFlag[] {
  return [...flags].sort((a, b) => {
    const sa = FlagStart(a);
    const sb = FlagStart(b);
    return sa.line - sb.line || (a.spans[0]?.from ?? 0) - (b.spans[0]?.from ?? 0);
  });
}

const escapeMarkdown = (text: string) => text.replace(/([\\`*_[\]<>#|])/g, "\\$1");

function quoteLine(excerpt: FlagExcerpt): string {
  const bold = excerpt.text.trim() ? `**${escapeMarkdown(excerpt.text.trim())}**` : "";
  const lead = excerpt.text.match(/^\s*/)?.[0] ?? "";
  const trail = excerpt.text.match(/\s*$/)?.[0] ?? "";
  const body = `${escapeMarkdown(excerpt.before)}${lead}${bold}${trail}${escapeMarkdown(excerpt.after)}`.trim();
  return excerpt.background ? `(${body})` : body;
}

/** The whole review as Markdown: each flag with its time, line, quoted words and note. */
export function ReviewToMarkdown(review: SongReview): string {
  const flags = SortFlags(review.flags);
  const out: string[] = [];
  out.push(`## Lyrics review: ${escapeMarkdown(review.name || "Untitled")}`);
  out.push("");
  out.push(`${flags.length} flag${flags.length === 1 ? "" : "s"}`);
  flags.forEach((flag, i) => {
    const excerpts = [...flag.excerpts].sort((a, b) => a.line - b.line);
    const first = excerpts[0];
    const where = [
      first?.time !== undefined ? `**${FormatFlagTime(first.time)}**` : null,
      first ? `line ${first.line + 1}${excerpts.length > 1 ? `–${excerpts[excerpts.length - 1].line + 1}` : ""}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    out.push("");
    out.push(`${i + 1}. ${where}${where ? " — " : ""}${FlagLabel(flag)}`);
    for (const excerpt of excerpts) out.push(`   > ${quoteLine(excerpt)}`);
    const note = flag.note.trim();
    if (note) {
      out.push("");
      for (const line of note.split(/\r?\n/)) out.push(`   ${line}`);
    }
  });
  return out.join("\n") + "\n";
}

/** Whether two spans lists share a word, so a new selection over a flag edits it. */
export function SpansOverlap(a: FlagSpan[], b: FlagSpan[]): boolean {
  return a.some((x) => b.some((y) => x.line === y.line && x.from <= y.to && y.from <= x.to));
}

export function NewFlagId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

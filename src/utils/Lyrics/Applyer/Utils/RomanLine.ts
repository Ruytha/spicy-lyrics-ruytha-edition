// Romanization Under the Lyrics: the romanization row under a line, lit up in time
// with the lyrics. Each part (a syllable, or the whole line for line-synced lyrics) is a
// span whose --SL_RomanFill runs from 0 to 1 over its times, which RuythaPage.css turns
// into the same left-to-right sweep the lyrics get.
import { SpotifyPlayer } from "../../../../components/Global/SpotifyPlayer.ts";
import { onAnimationFrame } from "../../../AnimationFrameLoop.ts";
import type { RomanPart } from "./PickDisplayText.ts";

const toMs = (seconds: number) => Math.max(0, Math.round(seconds * 1000));

type Row = {
  spans: HTMLElement[];
  starts: number[];
  ends: number[];
  fills: number[];
  start: number;
  end: number;
  // Where the playhead was last frame: -1 before the row, 1 after it, 0 inside it.
  phase: number | null;
};

const rows = new Map<HTMLElement, Row>();

/** Fills `row` with the parts and keeps it in time with the song. */
export function FillRomanRow(row: HTMLElement, parts: RomanPart[]): void {
  row.textContent = "";
  const entry: Row = { spans: [], starts: [], ends: [], fills: [], start: Infinity, end: 0, phase: null };
  for (const part of parts) {
    const span = document.createElement("span");
    span.className = "SL_RomanPart";
    span.textContent = part.text;
    row.appendChild(span);
    const start = toMs(part.start);
    const end = Math.max(start + 1, toMs(part.end));
    entry.spans.push(span);
    entry.starts.push(start);
    entry.ends.push(end);
    entry.fills.push(-1);
    entry.start = Math.min(entry.start, start);
    entry.end = Math.max(entry.end, end);
  }
  row.classList.add("SL_RomanSynced");
  rows.set(row, entry);
}

/** Drops the rows of lyrics that have been replaced. */
export function ClearRomanRows(): void {
  rows.clear();
}

/** Spicy's renderer: the romanization as a smaller row at the bottom of the line. */
export function AppendRomanLine(lineElem: HTMLElement, text: string, parts?: RomanPart[]): void {
  if (!text) return;
  const roman = document.createElement("div");
  roman.className = "SL_RomanLine";
  if (parts && parts.length > 0) FillRomanRow(roman, parts);
  else roman.textContent = text;
  lineElem.appendChild(roman);
  lineElem.classList.add("HasRomanLine");
}

function setFill(row: Row, i: number, fill: number) {
  if (row.fills[i] === fill) return;
  row.fills[i] = fill;
  row.spans[i].style.setProperty("--SL_RomanFill", fill.toFixed(3));
}

onAnimationFrame(() => {
  if (rows.size === 0) return;
  const position = SpotifyPlayer.GetPosition();
  for (const [el, row] of rows) {
    // Spicy's list unmounts rows off screen; their spans still get set once they're reached.
    if (!el.isConnected) {
      row.phase = null;
      continue;
    }
    const phase = position < row.start ? -1 : position >= row.end ? 1 : 0;
    if (phase === row.phase && phase !== 0) continue;
    row.phase = phase;
    for (let i = 0; i < row.spans.length; i++) {
      const progress = (position - row.starts[i]) / (row.ends[i] - row.starts[i]);
      setFill(row, i, Math.min(1, Math.max(0, progress)));
    }
  }
});

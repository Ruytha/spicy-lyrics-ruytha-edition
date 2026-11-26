/**
 * Turns the timed-lyrics formats the search-based sources serve (word-timed YRC lines and
 * LRC) into TTML, so they go through the same parser as every other source, and picks
 * which search result is the playing track. No imports, so tests can load it.
 */

const NS =
  'xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"';

type Word = { begin: number; end: number; text: string };
type Line = { begin: number; end: number; words?: Word[]; text?: string };

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const seconds = (ms: number) => (Math.max(0, ms) / 1000).toFixed(3);

/**
 * Credit lines the services put at the top or bottom of the lyrics ("作词 : …", "Composer: …").
 * Matched on a short role before a colon, so a sung line with a colon later on stays.
 */
const CREDIT_LINE =
  /^\s*(?:[\p{Script=Han}\s·/&]{1,12}|(?:lyrics?|lyricist|composer|composed|written|arranger|arranged|producer|produced|vocals?|mixing|mastering|music|words)(?:\s+by)?)\s*[:：]/iu;

export function IsCreditLine(text: string): boolean {
  return CREDIT_LINE.test(text);
}

function toTTML(lines: Line[], word: boolean, title?: string): string | null {
  const textOf = (line: Line) => (line.words ? line.words.map((w) => w.text).join("") : (line.text ?? ""));
  const kept = lines.filter((line) => textOf(line).trim() !== "");
  // Only the runs at the top and bottom: a sung line can have a colon too ("我说：…").
  // Some services open with a "Title - Artist" line.
  const heading = title ? NormalizeTitle(title) : "";
  const isHeading = (text: string) => heading !== "" && / - /.test(text) && NormalizeTitle(text) === heading;
  while (kept.length > 0 && (IsCreditLine(textOf(kept[0])) || isHeading(textOf(kept[0])))) kept.shift();
  while (kept.length > 0 && IsCreditLine(textOf(kept[kept.length - 1]))) kept.pop();
  if (kept.length === 0) return null;
  const end = Math.max(...kept.map((line) => line.end));
  const body = kept
    .map((line) => {
      const attrs = `begin="${seconds(line.begin)}" end="${seconds(line.end)}" ttm:agent="v1"`;
      if (!line.words) return `<p ${attrs}>${escapeXml(line.text!.trim())}</p>`;
      let inner = "";
      let space = false;
      for (const w of line.words) {
        if (w.text.trim() === "") {
          space = inner !== "";
          continue;
        }
        if (space || (inner !== "" && /^\s/.test(w.text))) inner += " ";
        inner += `<span begin="${seconds(w.begin)}" end="${seconds(w.end)}">${escapeXml(w.text.trim())}</span>`;
        space = /\s$/.test(w.text);
      }
      return `<p ${attrs}>${inner}</p>`;
    })
    .join("");
  return (
    `<tt ${NS} itunes:timing="${word ? "Word" : "Line"}"><head><metadata><ttm:agent type="person" xml:id="v1"/>` +
    `</metadata></head><body dur="${seconds(end)}"><div begin="${seconds(kept[0].begin)}" end="${seconds(end)}">` +
    `${body}</div></body></tt>`
  );
}

/**
 * Word-timed lines: `[lineStart,lineDuration](wordStart,wordDuration,0)word…`, in ms.
 * Lines of JSON (the services' credit blocks) and anything else are skipped.
 */
export function YrcToTTML(yrc: string, title?: string): string | null {
  const lines: Line[] = [];
  for (const raw of yrc.split(/\r?\n/)) {
    const head = /^\[(\d+),(\d+)\]/.exec(raw);
    if (!head) continue;
    const begin = Number(head[1]);
    const words: Word[] = [];
    const word = /\((\d+),(\d+)(?:,-?\d+)?\)([^(]*)/g;
    let match: RegExpExecArray | null;
    const rest = raw.slice(head[0].length);
    while ((match = word.exec(rest))) {
      const start = Number(match[1]);
      words.push({ begin: start, end: start + Number(match[2]), text: match[3] });
    }
    if (words.length === 0) continue;
    const end = Math.max(begin + Number(head[2]), ...words.map((w) => w.end));
    lines.push({ begin, end, words });
  }
  return toTTML(lines, true, title);
}

/**
 * `[mm:ss.xx]text` lines, a line possibly carrying several stamps. A line ends where the
 * next one starts; the last runs `lastLineMs` past its start.
 */
export function LrcToTTML(lrc: string, title?: string, lastLineMs = 5000): string | null {
  const stamped: { begin: number; text: string }[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "");
    for (const stamp of stamps) {
      stamped.push({ begin: Math.round((Number(stamp[1]) * 60 + Number(stamp[2])) * 1000), text });
    }
  }
  stamped.sort((a, b) => a.begin - b.begin);
  const lines: Line[] = stamped.map((line, i) => ({
    begin: line.begin,
    end: stamped[i + 1]?.begin ?? line.begin + lastLineMs,
    text: line.text,
  }));
  return toTTML(lines, false, title);
}

export type SearchCandidate<T> = { name: string; artists: string[]; durationMs: number; value: T };

/** Folds case, width and punctuation, and drops what services add to titles in brackets. */
export function NormalizeTitle(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+-\s+.*$/, "")
    .replace(/[([{【（].*?[)\]}】）]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const LATIN = /\p{Script=Latin}/u;
const normalizeArtist = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The search result that is the playing track, or null. Its length has to be within
 * `maxDurationDiffMs`, and then its title has to match, or, when the titles are in
 * different scripts (a romanized name against the original), one of its artists at a
 * near-exact length. Translated artist names are why a title match alone is enough.
 */
export function PickMatch<T>(
  track: { name: string; artists: string[]; durationMs: number },
  candidates: SearchCandidate<T>[],
  maxDurationDiffMs = 3000
): T | null {
  const title = NormalizeTitle(track.name);
  const artists = new Set(track.artists.map(normalizeArtist).filter(Boolean));
  let best: { score: number; diff: number; value: T } | null = null;
  for (const c of candidates) {
    const diff = track.durationMs > 0 && c.durationMs > 0 ? Math.abs(track.durationMs - c.durationMs) : Infinity;
    if (diff > maxDurationDiffMs) continue;
    const titleMatch = title !== "" && NormalizeTitle(c.name) === title;
    const artistMatch = c.artists.some((a) => artists.has(normalizeArtist(a)));
    // Without a title match, only when the titles can't be compared (one Latin, the other
    // not): two Latin titles that differ are two songs, however close their lengths.
    const comparable = LATIN.test(track.name) === LATIN.test(c.name);
    if (!titleMatch && !(artistMatch && diff <= 1000 && !comparable)) continue;
    const score = (titleMatch ? 2 : 0) + (artistMatch ? 1 : 0);
    if (!best || score > best.score || (score === best.score && diff < best.diff)) best = { score, diff, value: c.value };
  }
  return best?.value ?? null;
}

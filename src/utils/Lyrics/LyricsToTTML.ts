/**
 * Writes loaded lyrics data back out as TTML, for tools that read the file format.
 *
 * Lyrics from the API arrive already parsed, so this is the only TTML there is for
 * them. It keeps what a review needs: line and syllable timing, word breaks,
 * background vocals, which singer each line belongs to, and the songwriters. It
 * doesn't keep what the parsed data no longer has, such as the original file's line
 * keys or its translations.
 */

type Seconds = number | undefined;

interface Syllable {
  Text: string;
  IsPartOfWord?: boolean;
  StartTime: Seconds;
  EndTime: Seconds;
}

interface VocalGroup {
  Syllables?: Syllable[];
  StartTime: Seconds;
  EndTime: Seconds;
}

interface LyricsData {
  Type?: string;
  SongWriters?: string[];
  Lines?: { Text?: string }[];
  Content?: {
    OppositeAligned?: boolean;
    Text?: string;
    StartTime?: Seconds;
    EndTime?: Seconds;
    Lead?: VocalGroup;
    Background?: VocalGroup[];
  }[];
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Seconds as a TTML clock value, e.g. 83.5 → "1:23.500". */
export function FormatTTMLTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(ms / 60000);
  const rest = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
  return `${minutes}:${rest}`;
}

const timing = (start: Seconds, end: Seconds) =>
  (typeof start === "number" ? ` begin="${FormatTTMLTime(start)}"` : "") +
  (typeof end === "number" ? ` end="${FormatTTMLTime(end)}"` : "");

const agent = (oppositeAligned: boolean | undefined) => ` ttm:agent="${oppositeAligned ? "v2" : "v1"}"`;

/** A group's syllables as spans, with a space wherever a word ends. */
function syllableSpans(syllables: Syllable[] | undefined): string {
  if (!syllables?.length) return "";
  return syllables
    .map((syllable, i) => {
      const span = `<span${timing(syllable.StartTime, syllable.EndTime)}>${escapeXml(syllable.Text ?? "")}</span>`;
      const last = i === syllables.length - 1;
      return last || syllable.IsPartOfWord ? span : `${span} `;
    })
    .join("");
}

function lineElements(data: LyricsData): string[] {
  if (data.Type === "Static") {
    return (data.Lines ?? []).map((line) => `<p>${escapeXml(line.Text ?? "")}</p>`);
  }
  if (data.Type === "Line") {
    return (data.Content ?? []).map(
      (line) =>
        `<p${timing(line.StartTime, line.EndTime)}${agent(line.OppositeAligned)}>${escapeXml(line.Text ?? "")}</p>`
    );
  }
  return (data.Content ?? []).map((line) => {
    const lead = line.Lead;
    const background = (line.Background ?? [])
      .map((group) => {
        const spans = syllableSpans(group.Syllables);
        return spans ? ` <span ttm:role="x-bg"${timing(group.StartTime, group.EndTime)}>${spans}</span>` : "";
      })
      .join("");
    return `<p${timing(lead?.StartTime, lead?.EndTime)}${agent(line.OppositeAligned)}>${syllableSpans(lead?.Syllables)}${background}</p>`;
  });
}

/** TTML for `data`, or null when it holds no lyrics lines. */
export function LyricsToTTML(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const lyrics = data as LyricsData;
  if (lyrics.Type !== "Static" && lyrics.Type !== "Line" && lyrics.Type !== "Syllable") return null;

  const lines = lineElements(lyrics);
  if (lines.length === 0) return null;

  const timingMode = lyrics.Type === "Syllable" ? "Word" : lyrics.Type === "Line" ? "Line" : "None";
  const writers = (lyrics.SongWriters ?? []).filter((name) => typeof name === "string" && name.trim());
  const songwriters = writers.length
    ? `<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters>${writers
        .map((name) => `<songwriter>${escapeXml(name)}</songwriter>`)
        .join("")}</songwriters></iTunesMetadata>`
    : "";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="${timingMode}">`,
    `<head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="person" xml:id="v2"/>${songwriters}</metadata></head>`,
    `<body><div>`,
    ...lines,
    `</div></body>`,
    `</tt>`,
  ].join("\n");
}

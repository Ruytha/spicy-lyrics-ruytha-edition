// deno-lint-ignore-file no-explicit-any

import { $romanizationBelow } from "../../../stores.ts";
import { HasLyricsText } from "../../EmptyLines.ts";
import { StripZeroWidth } from "./StripZeroWidth.ts";

// Which of an entry's two texts to render.
//
// Normally that is simply the romanization when the romanized view is on and
// the original otherwise, but either one can be missing: TTML lines carrying
// only an `x-roman` span have no source text at all, and most lines have no
// romanization. Whichever side is absent falls back to the other so a line we
// kept because it has *some* text never renders blank.
export function PickDisplayText(entry: any, useRomanized: boolean): string {
  const original = entry?.Text;
  const romanized = entry?.TransliteratedText;

  if (useRomanized && romanized !== undefined) return romanized;
  if (HasLyricsText(original)) return original;
  return HasLyricsText(romanized) ? romanized : (original ?? "");
}

// Romanization Under the Lyrics: whether romanization replaces the lyric, or the lyric
// stays and the romanization sits under it.
export const RomanizeInPlace = (useRomanized: boolean) => useRomanized && !$romanizationBelow.get();
export const RomanizeBelow = (useRomanized: boolean) => useRomanized && $romanizationBelow.get();

// The romanization shown under a line. Empty when the line has none, or when the
// romanization is all it has (PickDisplayText already shows it as the line itself).
export function RomanizedLine(entry: any): string {
  if (!HasLyricsText(entry?.Text) || !HasLyricsText(entry?.TransliteratedText)) return "";
  return differs(entry.Text, entry.TransliteratedText) ? StripZeroWidth(entry.TransliteratedText).trim() : "";
}

// A line in Latin letters can carry a "romanization" that only changes its case or
// spacing; repeating it under the line would show the same words twice.
const comparable = (text: string) => StripZeroWidth(text).toLowerCase().replace(/[\s\p{P}]+/gu, "");
const differs = (original: string, romanized: string) => comparable(original) !== comparable(romanized);

// The same for a sung line: its syllables' romanizations joined back into words, with
// the original text kept for syllables that have none (Latin words in a Japanese line).
export function RomanizedSyllables(syllables: any[]): string {
  if (!syllables.some((s) => HasLyricsText(s?.Text) && HasLyricsText(s?.TransliteratedText))) return "";
  const text = syllables
    .map((s, i) => {
      const part = HasLyricsText(s?.TransliteratedText) ? s.TransliteratedText : (s?.Text ?? "");
      return s?.IsPartOfWord || i === syllables.length - 1 ? part : `${part} `;
    })
    .join("");
  const original = syllables.map((s) => s?.Text ?? "").join("");
  return differs(original, text) ? StripZeroWidth(text).replace(/\s+/g, " ").trim() : "";
}

export default PickDisplayText;

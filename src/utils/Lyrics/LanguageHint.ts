// Detects a song's language from its lyrics and maps it to the romanizer it hints at.
// Kept apart from ProcessLyrics.ts (which reaches the page) so tests can load it.
import { franc } from "franc";
import langs from "langs";

export type RomanizationBranch = "Japanese" | "Chinese" | "Korean" | "Cyrillic" | "Greek";

/** The ISO 639-3 code franc picks (`und` when unsure) and its ISO 639-1 code, if any. */
export function detectLanguage(text: string): { language: string; iso2: string | undefined } {
  const language = franc(text);
  return { language, iso2: langs.where("3", language)?.["1"] };
}

/** The romanizer a detected language points to, if any. */
export function romanizationBranchFromLanguage(
  primaryLanguage: string,
  iso2Language: string | undefined
): RomanizationBranch | undefined {
  if (primaryLanguage === "jpn") return "Japanese";
  if (primaryLanguage === "cmn") return "Chinese";
  if (primaryLanguage === "kor") return "Korean";
  if (
    primaryLanguage === "bel" ||
    primaryLanguage === "bul" ||
    primaryLanguage === "kaz" ||
    iso2Language === "ky" ||
    primaryLanguage === "mkd" ||
    iso2Language === "mn" ||
    primaryLanguage === "rus" ||
    primaryLanguage === "srp" ||
    primaryLanguage === "tgk" ||
    primaryLanguage === "ukr"
  ) {
    return "Cyrillic";
  }
  if (primaryLanguage === "ell") return "Greek";
  return undefined;
}

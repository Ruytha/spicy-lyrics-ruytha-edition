/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// The parser's imports read settings at load (stores.ts), which expects the browser
// and Spicetify; these stand-ins are enough for parsing.
const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.Spicetify ??= { LocalStorage: { get: () => null, set() {} } };

const { parseTTML } = await import("../src/utils/Lyrics/ttml/parser.ts");
const { RomajiWordBreaks } = await import("../src/utils/Lyrics/RomajiSpacing.ts");

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

type Group = { TranslatedText?: string; Syllables: { Text: string }[] };
type Vocal = { Lead: Group; Background?: Group[] };

describe("background vocals and translations", () => {
  const lyrics = parseTTML(fixture("background-and-translations.ttml")) as { Content: Vocal[] };
  const [first, second] = lyrics.Content;

  test("a line keeps every background vocal", () => {
    expect(first.Background?.map((bg) => bg.Syllables.map((s) => s.Text).join(" "))).toEqual([
      "Echo eins",
      "Echo zwei",
    ]);
  });
  test("translations come from the head", () => {
    expect(first.Lead.TranslatedText).toBe("The first line");
  });
  test("the head's background translation goes to the first background vocal", () => {
    expect(first.Background?.[0].TranslatedText).toBe("(first echo)");
    expect(first.Background?.[1].TranslatedText).toBeUndefined();
  });
  test("an inline translation wins over the head's", () => {
    expect(second.Lead.TranslatedText).toBe("Second line, inline");
  });
});

describe("romaji word gaps", () => {
  test("gaps land between the syllables a word ends at", () => {
    expect(
      RomajiWordBreaks(["ai", "kawa", "razu", "dap", "pi", "shi", "teru", "mai", "nichi"], "aikawarazu dappi shiteru mainichi")
    ).toEqual([false, false, true, false, true, false, true, false, false]);
  });
  test("small spelling differences still line up", () => {
    // The line's romaji has a macron where the syllable's has a doubled vowel.
    expect(RomajiWordBreaks(["kyou", "wa", "ii", "hi"], "kyō wa ii hi")).toEqual([true, true, true, false]);
  });
  test("no gap where no syllable edge is close", () => {
    expect(RomajiWordBreaks(["abcdefgh"], "abcd efgh")).toEqual([false]);
  });
});

// The synced romanization and the background rows lean on parts of AMLL that aren't
// its public API (AMLL.ts). After updating @applemusic-like-lyrics/core, this says
// which of them moved, before it shows up as unsynced romaji or merged rows in Spotify.
describe("AMLL internals the AMLL renderer uses", () => {
  const amll = readFileSync(
    new URL("../node_modules/@applemusic-like-lyrics/core/dist/amll-core.mjs", import.meta.url),
    "utf8"
  );
  test.each([
    ["the line class sets its sub-lines in setSubLinesText(trans, roman)", "setSubLinesText(trans, roman)"],
    ["the romanization is the line's third child", "const roman = this.element.children[2];"],
    ["the player keeps its groups in currentLyricGroups", "currentLyricGroups = [];"],
    ["a line knows whether it's built", "this.built = true;"],
    ["space folding is an option (normalizeSpaces)", "normalizeSpaces: true"],
    ["a group holds one background line", "addBgLine(bgLine) {"],
  ])("%s", (_, needle) => {
    expect(amll.includes(needle)).toBe(true);
  });
});

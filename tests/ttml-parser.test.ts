/// <reference types="bun" />
import { describe, expect, test } from "bun:test";

// The parser's imports read settings at load (stores.ts), which expects the browser
// and Spicetify; these stand-ins are enough for parsing.
const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.Spicetify ??= { LocalStorage: { get: () => null, set() {} } };

const { parseTTML } = await import("../src/utils/Lyrics/ttml/parser.ts");

const NS =
  'xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"';
const HEAD =
  '<head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="person" xml:id="v2"/></metadata></head>';

const lineTTML = (withHead: boolean) =>
  `<tt ${NS} itunes:timing="Line">${withHead ? HEAD : ""}<body><div begin="1.0" end="7.0">` +
  '<p begin="1.0" end="3.0" ttm:agent="v1">Main singer</p>' +
  '<p begin="3.0" end="5.0" ttm:agent="v2">Duet singer</p>' +
  '<p begin="5.0" end="7.0" ttm:agent="v1">Main again</p>' +
  "</div></body></tt>";

const wordTTML = (withHead: boolean) =>
  `<tt ${NS} itunes:timing="Word">${withHead ? HEAD : ""}<body><div begin="1.0" end="5.0">` +
  '<p begin="1.0" end="3.0" ttm:agent="v1"><span begin="1.0" end="2.0">Main</span> <span begin="2.0" end="3.0">line</span></p>' +
  '<p begin="3.0" end="5.0" ttm:agent="v2"><span begin="3.0" end="4.0">Duet</span> <span begin="4.0" end="5.0">line</span></p>' +
  "</div></body></tt>";

const sides = (xml: string) =>
  ((parseTTML(xml) as { Content?: { OppositeAligned?: boolean }[] } | null)?.Content ?? []).map(
    (line) => !!line.OppositeAligned
  );

describe("TTML duet lines", () => {
  test("line-synced, agents declared", () => {
    expect(sides(lineTTML(true))).toEqual([false, true, false]);
  });
  test("line-synced, agents not declared", () => {
    expect(sides(lineTTML(false))).toEqual([false, true, false]);
  });
  test("word-synced, agents declared", () => {
    expect(sides(wordTTML(true))).toEqual([false, true]);
  });
  test("word-synced, agents not declared", () => {
    expect(sides(wordTTML(false))).toEqual([false, true]);
  });
  test("a div's agent applies to its lines", () => {
    const xml =
      `<tt ${NS} itunes:timing="Line"><body><div begin="1.0" end="3.0" ttm:agent="v2">` +
      '<p begin="1.0" end="3.0">Whole verse is the duet singer</p></div></body></tt>';
    expect(sides(xml)).toEqual([true]);
  });
});

/// <reference types="bun" />
import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

// The parser's imports read settings at load (stores.ts), which expects the browser
// and Spicetify; these stand-ins are enough here.
const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.Spicetify ??= { LocalStorage: { get: () => null, set() {} } };
// The modal and the player need the Spotify page; opening TextFlag isn't tested here.
mock.module("../src/components/Modal.ts", () => ({ PopupModal: {} }));
mock.module("../src/components/Global/SpotifyPlayer.ts", () => ({ SpotifyPlayer: {} }));

const { parseTTML } = await import("../src/utils/Lyrics/ttml/parser.ts");
const { LyricsToTTML, FormatTTMLTime } = await import("../src/utils/Lyrics/LyricsToTTML.ts");
const { TextFlagUrl, TEXTFLAG_URL } = await import("../src/utils/textflag.ts");

const NS =
  'xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"';
const HEAD =
  '<head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="person" xml:id="v2"/>' +
  '<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>A &amp; B</songwriter></songwriters></iTunesMetadata>' +
  "</metadata></head>";

const wordTTML =
  `<tt ${NS} itunes:timing="Word">${HEAD}<body><div begin="1.0" end="9.0">` +
  '<p begin="1.0" end="3.0" ttm:agent="v1"><span begin="1.0" end="1.4">Beau</span><span begin="1.4" end="2.0">tiful</span> <span begin="2.0" end="3.0">&lt;day&gt;</span>' +
  '<span ttm:role="x-bg"><span begin="2.5" end="2.8">(oh</span> <span begin="2.8" end="3.0">yeah)</span></span></p>' +
  '<p begin="3.0" end="5.0" ttm:agent="v2"><span begin="3.0" end="4.0">Duet</span> <span begin="4.0" end="5.0">line</span></p>' +
  "</div></body></tt>";

const lineTTML =
  `<tt ${NS} itunes:timing="Line">${HEAD}<body><div begin="1.0" end="5.0">` +
  '<p begin="1.0" end="3.0" ttm:agent="v1">Main singer</p>' +
  '<p begin="3.0" end="5.0" ttm:agent="v2">Duet singer</p>' +
  "</div></body></tt>";

const syllables = (group: any) =>
  (group?.Syllables ?? []).map((s: any) => [s.Text, s.StartTime, s.EndTime, !!s.IsPartOfWord]);

/** What a review depends on, so a round trip can be compared field by field. */
function shape(data: any) {
  if (data.Type === "Line") {
    return data.Content.map((l: any) => [l.Text, l.StartTime, l.EndTime, !!l.OppositeAligned]);
  }
  return data.Content.map((l: any) => ({
    side: !!l.OppositeAligned,
    lead: syllables(l.Lead),
    background: (l.Background ?? []).map(syllables),
  }));
}

describe("lyrics written back to TTML", () => {
  for (const [name, source] of [
    ["word-synced with background vocals and a duet", wordTTML],
    ["line-synced duet", lineTTML],
    ["the background-and-translations fixture", readFileSync(new URL("./fixtures/background-and-translations.ttml", import.meta.url), "utf8")],
  ] as const) {
    test(`${name} parses back the same`, () => {
      const parsed = parseTTML(source)!;
      const written = LyricsToTTML(parsed)!;
      const reparsed = parseTTML(written)!;
      expect(reparsed.Type).toBe(parsed.Type);
      expect(shape(reparsed)).toEqual(shape(parsed));
      expect(reparsed.SongWriters ?? []).toEqual(parsed.SongWriters ?? []);
    });
  }

  test("static lyrics keep their lines", () => {
    const written = LyricsToTTML({ Type: "Static", Lines: [{ Text: "One" }, { Text: "Two & three" }] })!;
    expect(written).toContain('itunes:timing="None"');
    expect(written).toContain("<p>Two &amp; three</p>");
  });

  test("nothing to write is null", () => {
    expect(LyricsToTTML(null)).toBeNull();
    expect(LyricsToTTML("NO_LYRICS:spotify:track:x")).toBeNull();
    expect(LyricsToTTML({ Type: "Syllable", Content: [] })).toBeNull();
  });

  test("times are TTML clock values", () => {
    expect(FormatTTMLTime(0)).toBe("0:00.000");
    expect(FormatTTMLTime(83.5)).toBe("1:23.500");
    expect(FormatTTMLTime(3725.0004)).toBe("62:05.000");
  });
});

describe("TextFlag link", () => {
  // TextFlag reads #src=, fetches it, and names the review after its last path segment.
  const readAsTextFlag = async (url: string) => {
    const parsed = new URL(url);
    expect(parsed.search).toBe("");
    const src = new URLSearchParams(parsed.hash.slice(1)).get("src")!;
    // Browsers drop a data URL's fragment when fetching it; Bun refuses one, so it's cut here.
    const text = await (await fetch(src.split("#")[0])).text();
    const name = decodeURIComponent(src.split("?")[0].split("/").pop()!);
    return { text, name };
  };

  test("carries the TTML and the song's name", async () => {
    const ttml = '<tt>Día — 夜明け & "quotes" / slashes ? marks</tt>';
    const url = TextFlagUrl(ttml, "Artist / Band - Song? (Live)");
    expect(url.startsWith(`${TEXTFLAG_URL}#src=`)).toBe(true);
    const { text, name } = await readAsTextFlag(url);
    expect(text).toBe(ttml);
    expect(name).toBe("Artist / Band - Song? (Live)");
  });
});

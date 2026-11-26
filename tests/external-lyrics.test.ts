/// <reference types="bun" />
import { describe, expect, test } from "bun:test";

const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.Spicetify ??= { LocalStorage: { get: () => null, set() {} } };

const { LrcToTTML, PickMatch, YrcToTTML, IsCreditLine } = await import("../src/utils/Lyrics/ExternalFormats.ts");
const { parseTTML } = await import("../src/utils/Lyrics/ttml/parser.ts");

describe("YrcToTTML", () => {
  const yrc = [
    '{"t":0,"c":[{"tx":"作词: "},{"tx":"Someone"}]}',
    "[630,2610](630,390,0)Couldn't (1020,240,0)beat (1260,90,0)her(1350,30,0) (1380,270,0)smile",
    "[3240,1740](3240,660,0)秘(3900,300,0)密",
  ].join("\n");

  test("builds word-synced lyrics, keeping word gaps and skipping credit blocks", () => {
    const parsed: any = parseTTML(YrcToTTML(yrc)!);
    expect(parsed.Type).toBe("Syllable");
    expect(parsed.Content).toHaveLength(2);
    const ttml = YrcToTTML(yrc)!;
    expect(ttml).toContain('<span begin="0.630" end="1.020">Couldn\'t</span> <span');
    expect(ttml).toContain(">her</span> <span");
    expect(ttml).toContain(">秘</span><span");
  });
});

describe("LrcToTTML", () => {
  test("drops the heading and credit lines, and ends each line at the next", () => {
    const lrc = [
      "[ti:Viva La Vida]",
      "[00:00.00]Viva la Vida - Coldplay",
      "[00:04.14]Lyrics by：Chris Martin",
      "[00:13.26]I used to rule the world",
      "[00:17.01]Seas would rise when I gave the word",
      "[00:19.82]",
      "[00:23.92][01:23.92]Sweep the streets",
    ].join("\n");
    const ttml = LrcToTTML(lrc, "Viva La Vida")!;
    expect(ttml).not.toContain("Coldplay");
    expect(ttml).not.toContain("Lyrics by");
    expect(ttml).toContain('<p begin="13.260" end="17.010"');
    expect(ttml).toContain('<p begin="17.010" end="19.820"');
    expect(ttml.match(/Sweep the streets/g)).toHaveLength(2);
    expect((parseTTML(ttml) as any).Type).toBe("Line");
  });

  test("keeps a sung line with a colon in the middle of the song", () => {
    const ttml = LrcToTTML("[00:01.00]作词：某人\n[00:05.00]第一句\n[00:09.00]我说：你好\n[00:13.00]最后一句")!;
    expect(ttml).toContain("我说：你好");
    expect(ttml).not.toContain("作词");
    expect(IsCreditLine("作曲 : 某人")).toBe(true);
    expect(IsCreditLine("I used to rule the world")).toBe(false);
  });
});

describe("PickMatch", () => {
  const track = { name: "Viva La Vida", artists: ["Coldplay"], durationMs: 242373 };
  const c = (name: string, artists: string[], durationMs: number, value: number) => ({ name, artists, durationMs, value });

  test("prefers a title and artist match at the closest length", () => {
    expect(
      PickMatch(track, [
        c("Viva La Vida (Live in Paris, 2008)", ["Coldplay"], 324133, 1),
        c("Viva la Vida", ["Coldplay"], 241426, 2),
        c("Viva La Vida", ["Coldplay"], 242373, 3),
      ])
    ).toBe(3);
  });

  test("rejects results of another length or another song", () => {
    expect(PickMatch(track, [c("Viva La Vida", ["Coldplay"], 251066, 1), c("Yellow", ["Coldplay"], 242000, 2)])).toBeNull();
  });

  test("takes a title in another script when the artist and length match", () => {
    expect(PickMatch({ name: "Idol", artists: ["YOASOBI"], durationMs: 213000 }, [c("アイドル", ["YOASOBI"], 213400, 7)])).toBe(7);
  });
});

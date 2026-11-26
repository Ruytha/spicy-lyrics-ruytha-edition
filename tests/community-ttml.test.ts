/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { BuildCommunityIndex } from "../src/utils/Lyrics/CommunityIndex.ts";

const line = (file: string, metadata: [string, string[]][]) => JSON.stringify({ metadata, rawLyricFile: file });

describe("BuildCommunityIndex", () => {
  test("maps Spotify ids and ISRCs to the raw file", () => {
    const index = BuildCommunityIndex(
      line("1-a.ttml", [
        ["spotifyId", ["4FUIkOJmzuGdPx7Pv9dlAc", "3D8OZFu0Z9R1IWwKbrj6NA"]],
        ["isrc", ["frx762649415"]],
        ["musicName", ["Song"]],
      ])
    );
    expect(index.spotify["4FUIkOJmzuGdPx7Pv9dlAc"]).toBe("raw-lyrics/1-a.ttml");
    expect(index.spotify["3D8OZFu0Z9R1IWwKbrj6NA"]).toBe("raw-lyrics/1-a.ttml");
    expect(index.isrc["FRX762649415"]).toBe("raw-lyrics/1-a.ttml");
  });

  test("a later submission replaces an earlier one", () => {
    const index = BuildCommunityIndex(
      [line("1-old.ttml", [["spotifyId", ["x"]]]), line("2-new.ttml", [["spotifyId", ["x"]]])].join("\n")
    );
    expect(index.spotify.x).toBe("raw-lyrics/2-new.ttml");
  });

  test("skips broken lines and file names that aren't plain", () => {
    const index = BuildCommunityIndex(
      ["not json", line("../../evil.ttml", [["spotifyId", ["y"]]]), line("ok.ttml", [["spotifyId", ["z"]]]), ""].join("\n")
    );
    expect(Object.hasOwn(index.spotify, "y")).toBe(false);
    expect(index.spotify.z).toBe("raw-lyrics/ok.ttml");
  });
});

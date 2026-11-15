/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { ReviewFlag } from "../src/utils/Review/ReviewFlags.ts";

const memory = new Map<string, string>();
(globalThis as Record<string, unknown>).Spicetify = {
  LocalStorage: {
    get: (key: string) => memory.get(key) ?? null,
    set: (key: string, value: string) => memory.set(key, value),
    remove: (key: string) => memory.delete(key),
  },
};

const {
  FlagLabel,
  FormatFlagTime,
  LoadReview,
  ReviewToMarkdown,
  SaveReview,
  SortFlags,
  SpansOverlap,
} = await import("../src/utils/Review/ReviewFlags.ts");

const flag = (over: Partial<ReviewFlag>): ReviewFlag => ({
  id: "x",
  spans: [{ line: 0, from: 0, to: 0 }],
  excerpts: [{ line: 0, time: 1000, background: false, before: "", text: "Hello", after: " world" }],
  kind: null,
  note: "",
  ...over,
});

describe("flag labels", () => {
  test("timing flags spell out which part and which way", () => {
    expect(FlagLabel({ kind: "timing", timing: { part: "start", direction: "early" } })).toBe("Starts too early");
    expect(FlagLabel({ kind: "timing", timing: { part: "end", direction: "late" } })).toBe("Ends too late");
    expect(FlagLabel({ kind: "timing", timing: { part: "line", direction: "late" } })).toBe("Too late");
  });
  test("other kinds use their name, and no kind is a plain flag", () => {
    expect(FlagLabel({ kind: "lineBreak" })).toBe("Line break");
    expect(FlagLabel({ kind: null })).toBe("Flag");
  });
});

describe("export", () => {
  test("flags come out in song order with time, line, quote and note", () => {
    const markdown = ReviewToMarkdown({
      name: "imase - NIGHT DANCER",
      flags: [
        flag({
          id: "b",
          spans: [{ line: 4, from: 1, to: 1 }],
          excerpts: [{ line: 4, time: 33203, background: false, before: "変わらない ", text: "ね", after: " 思い" }],
          kind: "spelling",
          note: "Should be ね\nnot ネ",
        }),
        flag({
          id: "a",
          spans: [{ line: 1, from: 3, to: 3 }],
          excerpts: [{ line: 1, time: 4985, background: false, before: "響めき煌めきと君も ", text: "oh", after: "" }],
          kind: "timing",
          timing: { part: "start", direction: "early" },
        }),
      ],
    });
    expect(markdown).toBe(
      [
        "## Lyrics review: imase - NIGHT DANCER",
        "",
        "2 flags",
        "",
        "1. **0:04.985** · line 2 — Starts too early",
        "   > 響めき煌めきと君も **oh**",
        "",
        "2. **0:33.203** · line 5 — Spelling",
        "   > 変わらない **ね** 思い",
        "",
        "   Should be ね",
        "   not ネ",
        "",
      ].join("\n")
    );
  });

  test("background lines are bracketed, multi-line flags list each line, Markdown is escaped", () => {
    const markdown = ReviewToMarkdown({
      name: "A*B",
      flags: [
        flag({
          spans: [
            { line: 2, from: 0, to: 0 },
            { line: 3, from: 0, to: 1 },
          ],
          excerpts: [
            { line: 3, time: 9000, background: true, before: "", text: "oh yeah", after: "" },
            { line: 2, time: 8000, background: false, before: "a ", text: "*star*", after: "" },
          ],
          kind: "lineBreak",
        }),
      ],
    });
    expect(markdown).toContain("## Lyrics review: A\\*B");
    expect(markdown).toContain("1. **0:08.000** · line 3–4 — Line break");
    expect(markdown).toContain("   > a **\\*star\\***\n   > (**oh yeah**)");
  });

  test("unsynced lyrics leave out the time", () => {
    const markdown = ReviewToMarkdown({
      name: "Song",
      flags: [flag({ excerpts: [{ line: 0, background: false, before: "", text: "Hi", after: "" }], kind: "other" })],
    });
    expect(markdown).toContain("1. line 1 — Other");
  });
});

describe("helpers", () => {
  test("times", () => {
    expect(FormatFlagTime(0)).toBe("0:00.000");
    expect(FormatFlagTime(83500)).toBe("1:23.500");
  });

  test("overlap is per line and word", () => {
    expect(SpansOverlap([{ line: 1, from: 2, to: 4 }], [{ line: 1, from: 4, to: 6 }])).toBe(true);
    expect(SpansOverlap([{ line: 1, from: 2, to: 3 }], [{ line: 1, from: 4, to: 6 }])).toBe(false);
    expect(SpansOverlap([{ line: 1, from: 0, to: 9 }], [{ line: 2, from: 0, to: 9 }])).toBe(false);
  });

  test("sorting by line, then word", () => {
    const sorted = SortFlags([
      flag({ id: "c", spans: [{ line: 3, from: 0, to: 0 }], excerpts: [{ line: 3, background: false, before: "", text: "", after: "" }] }),
      flag({ id: "b", spans: [{ line: 1, from: 5, to: 5 }], excerpts: [{ line: 1, background: false, before: "", text: "", after: "" }] }),
      flag({ id: "a", spans: [{ line: 1, from: 2, to: 2 }], excerpts: [{ line: 1, background: false, before: "", text: "", after: "" }] }),
    ]);
    expect(sorted.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  test("a song's review is saved, and forgotten once it has no flags", () => {
    SaveReview("spotify:track:1", { name: "Song", flags: [flag({})] });
    expect(LoadReview("spotify:track:1")?.flags).toHaveLength(1);
    SaveReview("spotify:track:1", { name: "Song", flags: [] });
    expect(LoadReview("spotify:track:1")).toBeNull();
    expect(memory.size).toBe(0);
  });
});

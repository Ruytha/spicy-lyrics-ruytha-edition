/// <reference types="bun" />
import { describe, expect, test } from "bun:test";

// remoteConfig.ts reads its persisted payload at load, which expects the browser and
// Spicetify; these stand-ins are enough for the sanitizer.
const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.Spicetify ??= { LocalStorage: { get: () => null, set() {} } };

const { detectLanguage, romanizationBranchFromLanguage } = await import("../src/utils/Lyrics/LanguageHint.ts");
const { sanitizeRemoteConfig } = await import("../src/utils/remoteConfig.ts");

describe("language hint", () => {
  // A line or two of lyrics per language; what matters is the romanizer each points to.
  const cases: [string, string, string | undefined][] = [
    ["Russian", "Я помню чудное мгновенье, передо мной явилась ты, как мимолётное виденье, как гений чистой красоты", "Cyrillic"],
    ["Ukrainian", "Ще не вмерла України і слава, і воля, ще нам, браття молодії, усміхнеться доля", "Cyrillic"],
    ["Bulgarian", "Горда Стара планина, до ней Дунава синей, слънце Тракия огрява, над Пирина пламеней", "Cyrillic"],
    ["Kazakh", "Алтын күн аспаны, алтын дән даласы, ерліктің дастаны, еліме қарашы", "Cyrillic"],
    ["Greek", "Σε γνωρίζω από την κόψη του σπαθιού την τρομερή, σε γνωρίζω από την όψη", "Greek"],
    ["Japanese", "君の名前を呼んでいた 夜明けの空に 届かない声を", "Japanese"],
    ["Chinese", "月亮代表我的心 你问我爱你有多深 我爱你有几分", "Chinese"],
    ["Korean", "사랑해요 그대를 정말로 사랑해 이 마음 다 주고 싶어", "Korean"],
    ["English", "I can see clearly now the rain is gone, I can see all obstacles in my way", undefined],
  ];

  for (const [name, text, branch] of cases) {
    test(`${name} hints ${branch ?? "no romanizer"}`, () => {
      const { language, iso2 } = detectLanguage(text);
      expect(romanizationBranchFromLanguage(language, iso2)).toBe(branch as never);
    });
  }

  test("ISO 639-1 codes are looked up for the hint", () => {
    expect(detectLanguage("Я помню чудное мгновенье, передо мной явилась ты").iso2).toBe("ru");
    expect(romanizationBranchFromLanguage("xxx", "ky")).toBe("Cyrillic");
    expect(romanizationBranchFromLanguage("xxx", "mn")).toBe("Cyrillic");
  });
});

describe("remote config sanitizer", () => {
  const defaults = sanitizeRemoteConfig({});
  // A payload that serves every key at its default, so nothing about it is a problem.
  const full = () => JSON.parse(JSON.stringify(defaults)) as Record<string, Record<string, unknown>>;

  test("a payload with every key at its default has no issues or notes", () => {
    const issues: string[] = [];
    const notes: string[] = [];
    sanitizeRemoteConfig(full(), issues, notes);
    expect(issues).toEqual([]);
    expect(notes).toEqual([]);
  });

  test("groups for other clients and local-only keys are notes, not issues", () => {
    const payload = full();
    payload.clientChecks = { silentWaitMs: 7000 };
    delete payload.token.sourceTimeoutMs;
    const issues: string[] = [];
    const notes: string[] = [];
    const config = sanitizeRemoteConfig(payload, issues, notes);
    expect(issues).toEqual([]);
    expect(notes).toHaveLength(2);
    expect(notes.some((n) => n.startsWith("clientChecks:"))).toBe(true);
    expect(notes.some((n) => n.startsWith("token.sourceTimeoutMs:"))).toBe(true);
    expect(config.token.sourceTimeoutMs).toBe(defaults.token.sourceTimeoutMs);
  });

  test("a missing shared key and a bad value are still issues", () => {
    const payload = full();
    delete payload.token.renewTimeoutMs;
    payload.token.expiryMarginMs = -5;
    const issues: string[] = [];
    const notes: string[] = [];
    const config = sanitizeRemoteConfig(payload, issues, notes);
    expect(issues.some((i) => i.startsWith("token.renewTimeoutMs: missing"))).toBe(true);
    expect(issues.some((i) => i.startsWith("token.expiryMarginMs: invalid"))).toBe(true);
    expect(notes).toEqual([]);
    expect(config.token.expiryMarginMs).toBe(defaults.token.expiryMarginMs);
  });

  test("served values apply", () => {
    const payload = full();
    payload.token.renewTimeoutMs = 12345;
    expect(sanitizeRemoteConfig(payload).token.renewTimeoutMs).toBe(12345);
  });
});

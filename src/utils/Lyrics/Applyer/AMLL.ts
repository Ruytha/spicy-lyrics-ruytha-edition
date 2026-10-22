import "@applemusic-like-lyrics/core/style.css";
import {
  LayoutReason,
  LyricPlayer,
  type LyricLine,
  type LyricLineMouseEvent,
  type LyricWord,
} from "@applemusic-like-lyrics/core";
import { $joinSplitWords, $lyricsRenderer } from "../../stores.ts";
import { PageContainer } from "../../../components/Pages/PageView.ts";
import { SpotifyPlayer } from "../../../components/Global/SpotifyPlayer.ts";
import { onAnimationFrame } from "../../AnimationFrameLoop.ts";
import Logger from "../../Logger.ts";
import { HasLyricsText, HasRenderableText, RemoveEmptyLyricsLines } from "../EmptyLines.ts";
import { SeekToLineStart, setRomanizedStatus } from "../lyrics.ts";
import { ApplySongCredits } from "./Credits/ApplyLyricsCredits.ts";
import { EmitApply } from "./OnApply.ts";
import { JoinSplitWords } from "./Utils/JoinSplitWords.ts";
import { PickDisplayText } from "./Utils/PickDisplayText.ts";
import { StripZeroWidth } from "./Utils/StripZeroWidth.ts";

const amllLyricsLogger = new Logger("AMLL Lyrics");

/** Class on #SpicyLyricsPage while the AMLL player is showing the lyrics. */
const PAGE_CLASS = "AmllLyrics";

interface SyllableData {
  Text: string;
  TransliteratedText?: string;
  StartTime: number;
  EndTime: number;
  IsPartOfWord?: boolean;
}

interface SyllableGroup {
  StartTime: number;
  EndTime: number;
  Syllables: SyllableData[];
}

interface SyllableLyrics {
  Type: "Syllable";
  Content: { Lead: SyllableGroup; Background?: SyllableGroup[]; OppositeAligned?: boolean }[];
  SongWriters?: string[];
}

interface LineLyrics {
  Type: "Line";
  Content: {
    Text: string;
    TransliteratedText?: string;
    StartTime: number;
    EndTime: number;
    OppositeAligned?: boolean;
  }[];
  SongWriters?: string[];
}

export function IsAmllLyricsEnabled(): boolean {
  return $lyricsRenderer.get() === "amll";
}

// ─── Conversion ──────────────────────────────────────────────────────────────
// Spicy's lyrics carry times in seconds; the player wants milliseconds, and throws
// on a word or line that ends before it starts.

const toMs = (seconds: number) => Math.max(0, Math.round(seconds * 1000));

function toLine(words: LyricWord[], isBG: boolean, isDuet: boolean): LyricLine {
  return {
    words,
    translatedLyric: "",
    romanLyric: "",
    startTime: Math.min(...words.map((w) => w.startTime)),
    endTime: Math.max(...words.map((w) => w.endTime)),
    isBG,
    isDuet,
  };
}

function toWords(syllables: SyllableData[], romanize: boolean): LyricWord[] {
  const parts = ($joinSplitWords.get() ? JoinSplitWords(syllables) : syllables).filter(
    HasRenderableText
  );
  return parts.map((syllable, i) => {
    const startTime = toMs(syllable.StartTime);
    const text = StripZeroWidth(PickDisplayText(syllable, romanize));
    // A syllable that ends a word is followed by a space, except at the end of the line.
    const spaced = syllable.IsPartOfWord || i === parts.length - 1 ? text : `${text} `;
    return { word: spaced, startTime, endTime: Math.max(startTime, toMs(syllable.EndTime)) };
  });
}

function convertSyllableLyrics(data: SyllableLyrics, romanize: boolean): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const entry of RemoveEmptyLyricsLines(data.Content)) {
    const isDuet = !!entry.OppositeAligned;
    const lead = toWords(entry.Lead.Syllables, romanize);
    if (lead.length === 0) continue;
    lines.push(toLine(lead, false, isDuet));
    // The player shows one background line per main line, so several groups become one.
    const background = (entry.Background ?? []).flatMap((group) =>
      toWords(group.Syllables, romanize)
    );
    if (background.length > 0) lines.push(toLine(background, true, isDuet));
  }
  return lines;
}

function convertLineLyrics(data: LineLyrics, romanize: boolean): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const entry of data.Content) {
    const text = StripZeroWidth(PickDisplayText(entry, romanize));
    if (!HasLyricsText(text)) continue;
    const startTime = toMs(entry.StartTime);
    const word = { word: text, startTime, endTime: Math.max(startTime, toMs(entry.EndTime)) };
    lines.push(toLine([word], false, !!entry.OppositeAligned));
  }
  return lines;
}

// ─── Player ──────────────────────────────────────────────────────────────────

let player: InstanceType<typeof LyricPlayer> | null = null;
let lastFrameTime = 0;
let wasPlaying = false;

export const IsAmllLyricsShowing = () => player !== null;

/** True while the user has scrolled the AMLL player away from the playing line. */
export const IsAmllScrolledAway = () =>
  // scrollState is protected in AMLL's types but is the player's own record of a user scroll.
  !!(player as unknown as { scrollState?: { isAutoAlignSuspended?: boolean } })?.scrollState
    ?.isAutoAlignSuspended;

export function AmllScrollBack() {
  if (!player) return;
  player.resetScroll();
  // resetScroll only clears the flag; lay out now so it also glides back while paused.
  player.calcLayout(LayoutReason.PlaybackTick);
}

export function DisposeAmllLyrics() {
  PageContainer?.classList.remove(PAGE_CLASS);
  if (!player) return;
  player.dispose();
  player = null;
}

/**
 * Render synced lyrics with the AMLL player. Returns false when it can't (unsynced
 * lyrics, or nothing left to show), so the caller uses Spicy's own renderer instead.
 */
export function ApplyAmllLyrics(
  data: { Type: string; [key: string]: any },
  romanize: boolean
): boolean {
  DisposeAmllLyrics();
  if (data.Type !== "Syllable" && data.Type !== "Line") {
    amllLyricsLogger.debug("Unsynced lyrics; using the default renderer", { type: data.Type });
    return false;
  }

  const host = PageContainer?.querySelector<HTMLElement>(".LyricsContainer .LyricsContent");
  if (!host) {
    amllLyricsLogger.debug("No lyrics area to mount the AMLL player in");
    return false;
  }

  let lines: LyricLine[];
  try {
    lines =
      data.Type === "Syllable"
        ? convertSyllableLyrics(data as SyllableLyrics, romanize)
        : convertLineLyrics(data as LineLyrics, romanize);
  } catch (err) {
    amllLyricsLogger.warn("Lyrics couldn't be converted for the AMLL player", err);
    return false;
  }
  if (lines.length === 0) {
    amllLyricsLogger.debug("No lines left after conversion; using the default renderer");
    return false;
  }

  const instance = new LyricPlayer();
  try {
    instance.setLyricLines(lines, SpotifyPlayer.GetPosition());
  } catch (err) {
    amllLyricsLogger.warn("AMLL player rejected these lyrics; using the default renderer", err);
    instance.dispose();
    return false;
  }

  // Songwriters, provider and community sync credits, built the same way as under Spicy's lines.
  ApplySongCredits(data, instance.getBottomLineElement());

  instance.addEventListener("line-click", (e) => {
    const line = (e as LyricLineMouseEvent).line.getLine();
    SeekToLineStart(line.startTime);
  });

  wasPlaying = SpotifyPlayer.IsPlaying;
  if (wasPlaying) instance.resume();
  else instance.pause();

  host.appendChild(instance.getElement());
  PageContainer?.classList.add(PAGE_CLASS);
  player = instance;
  lastFrameTime = performance.now();

  EmitApply(data.Type, data.Content);
  setRomanizedStatus(romanize);
  return true;
}

onAnimationFrame((timestamp) => {
  if (!player) return;
  // Anything that clears the lyrics area (a new fetch's loader, a notice) drops the element.
  if (!player.getElement().isConnected) {
    DisposeAmllLyrics();
    return;
  }

  const playing = SpotifyPlayer.IsPlaying;
  if (playing !== wasPlaying) {
    wasPlaying = playing;
    if (playing) player.resume();
    else player.pause();
  }

  player.setCurrentTime(SpotifyPlayer.GetPosition());
  player.update(Math.max(0, timestamp - lastFrameTime));
  lastFrameTime = timestamp;
});

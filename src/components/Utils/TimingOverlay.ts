import "../../css/TimingOverlay.css";
import { onAnimationFrame } from "../../utils/AnimationFrameLoop.ts";
import { GetAppliedLyrics } from "../../utils/Lyrics/Global/Applyer.ts";
import { $timingOverlay } from "../../utils/stores.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { PageContainer } from "../Pages/PageView.ts";

// For syncers: the playback time to the millisecond, and the start and end of the line
// and word playing now, read from the lyrics on screen. Clicking it copies the time.

interface Timed {
  StartTime: number;
  EndTime: number;
}

let panel: HTMLButtonElement | null = null;
let lastText = "";

/** 103.512 -> "1:43.512" */
function formatTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}

/** Index of the last entry starting at or before `time`, or -1. */
function lastStarted(entries: Timed[], time: number): number {
  let lo = 0;
  let hi = entries.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (entries[mid].StartTime <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

const span = (entry: Timed) => `${formatTime(entry.StartTime)} → ${formatTime(entry.EndTime)}`;

function describe(time: number): string[] {
  const rows = [formatTime(time)];
  const lyrics = GetAppliedLyrics();
  if (!lyrics || (lyrics.Type !== "Syllable" && lyrics.Type !== "Line")) {
    rows.push("No synced lyrics");
    return rows;
  }

  const lines: Timed[] = lyrics.Type === "Syllable"
    ? lyrics.Content.map((entry: { Lead?: Timed } & Timed) => entry.Lead ?? entry)
    : lyrics.Content;
  const index = lastStarted(lines, time);
  const line = lines[index];
  if (!line || time >= line.EndTime) {
    const next = lines[index + 1];
    rows.push(next ? `Gap · next line at ${formatTime(next.StartTime)}` : "After the last line");
    return rows;
  }
  rows.push(`Line ${index + 1} · ${span(line)}`);

  if (lyrics.Type === "Syllable") {
    const syllables: (Timed & { Text: string })[] = lyrics.Content[index].Lead?.Syllables ?? [];
    const word = syllables[lastStarted(syllables, time)];
    rows.push(
      word && time < word.EndTime
        ? `“${word.Text.trim()}” · ${span(word)}`
        : "Between words"
    );
  }
  return rows;
}

function ensurePanel(): HTMLButtonElement | null {
  if (!PageContainer) return null;
  if (panel?.parentElement === PageContainer) return panel;
  panel = PageContainer.ownerDocument.createElement("button");
  panel.type = "button";
  panel.className = "SL_TimingOverlay";
  panel.title = "Copy the current time";
  panel.addEventListener("click", () => {
    const time = formatTime(SpotifyPlayer.GetPosition() / 1000);
    navigator.clipboard?.writeText(time).then(
      () => Spicetify.showNotification?.(`Copied ${time}`),
      () => {}
    );
  });
  PageContainer.appendChild(panel);
  lastText = "";
  return panel;
}

onAnimationFrame(() => {
  if (!$timingOverlay.get() || !PageContainer) {
    if (panel) {
      panel.remove();
      panel = null;
    }
    return;
  }
  const el = ensurePanel();
  if (!el) return;
  const rows = describe(SpotifyPlayer.GetPosition() / 1000);
  const text = rows.join("\n");
  if (text === lastText) return;
  lastText = text;
  el.replaceChildren(
    ...rows.map((row, i) => {
      const div = el.ownerDocument.createElement("div");
      div.className = i === 0 ? "SL_TimingOverlay_Time" : "SL_TimingOverlay_Row";
      div.textContent = row;
      return div;
    })
  );
});

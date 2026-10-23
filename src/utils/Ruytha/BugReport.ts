import {
  $backgroundBeatPulse,
  $backgroundStyle,
  $beatPulseStrength,
  $lyricsRenderer,
  $spicyLyricsVersion,
} from "../stores.ts";
import { FORK_URL, GetForkRelease } from "./ForkRelease.ts";

// Bugs in the fork go to the fork, not the Spicy Lyrics team. This opens a new GitHub
// issue with the versions and the settings most likely to matter already filled in;
// nothing is sent until the reporter submits it themselves.

export function OpenBugReport() {
  const platform = (Spicetify.Platform ?? {}) as { version?: string; operatingSystem?: string };
  const pulse = $backgroundBeatPulse.get() ? `on (${$beatPulseStrength.get()})` : "off";
  const body = [
    "**What happened?**",
    "",
    "",
    "**What did you expect instead?**",
    "",
    "",
    "**Steps to make it happen again**",
    "1. ",
    "",
    "**Song** (a Spotify link, if it only happens on one)",
    "",
    "",
    "---",
    `- Ruytha Edition: ${GetForkRelease()?.name ?? "unknown"}`,
    `- Spicy Lyrics: ${$spicyLyricsVersion.get()}`,
    `- Spotify: ${platform.version ?? "unknown"}`,
    `- Spicetify: ${(Spicetify as { Config?: { version?: string } }).Config?.version ?? "unknown"}`,
    `- OS: ${platform.operatingSystem ?? navigator.platform}`,
    `- Background: ${$backgroundStyle.get()}, Pulse to the Beat ${pulse}`,
    `- Lyrics renderer: ${$lyricsRenderer.get()}`,
  ].join("\n");
  const url = `${FORK_URL}/issues/new?${new URLSearchParams({ body }).toString()}`;
  window.open(url, "_blank");
}

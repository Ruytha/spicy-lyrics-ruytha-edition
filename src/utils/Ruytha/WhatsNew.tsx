import React from "react";
import { showNotice } from "../../components/ReactComponents/NoticeDialog.tsx";
import { CHANGELOG_URL, GetForkRelease } from "./ForkRelease.ts";

// The fork updates itself on every Spotify restart, so nothing would otherwise say
// what changed. This shows the newest changelog section once per release.

const SEEN_KEY = "SL:ruytha:seenRelease";
/** More than this and the dialog gets tall; the rest are a click away. */
const MAX_ITEMS = 5;

/** The first sentence, so each item stays one or two lines. */
const firstSentence = (text: string) => text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;

/** Shows What's New if this release hasn't been shown yet. Returns whether it did. */
export function ShowForkWhatsNew(): boolean {
  const release = GetForkRelease();
  if (!release || release.items.length === 0) return false;
  if (Spicetify.LocalStorage.get(SEEN_KEY) === release.key) return false;
  Spicetify.LocalStorage.set(SEEN_KEY, release.key);

  const shown = release.items.slice(0, MAX_ITEMS);
  const more = release.items.length - shown.length;
  showNotice({
    title: "New in Ruytha Edition",
    content: [
      <ul className="sl-notice-text sl-whatsnew-list">
        {shown.map((item) => (
          <li key={item.title || item.text}>
            {item.title && <strong>{item.title}. </strong>}
            {firstSentence(item.text)}
          </li>
        ))}
      </ul>,
      <p className="sl-notice-text sl-notice-text--quiet">
        {more > 0
          ? `And ${more} more in the changelog. This update is from ${release.name}.`
          : `This update is from ${release.name}.`}
      </p>,
    ],
    primary: { label: "Full changelog", onClick: () => window.open(CHANGELOG_URL, "_blank") },
    secondaryLabel: "Close",
  });
  return true;
}

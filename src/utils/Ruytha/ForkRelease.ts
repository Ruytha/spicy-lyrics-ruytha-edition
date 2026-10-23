import { MAKER_AVATAR } from "./MakerAvatar.ts";
import changelog from "../../../CHANGELOG.md";

// The fork's newest release, read from the top section of CHANGELOG.md (bundled as
// text), so the What's New popup and bug reports never drift from the changelog.

export const FORK_REPO = "Ruytha/spicy-lyrics-ruytha-edition";
export const FORK_URL = `https://github.com/${FORK_REPO}`;
export const CHANGELOG_URL = `${FORK_URL}/blob/main/CHANGELOG.md`;
// The fork's maker, credited in the settings.
export const MAKER = {
  name: "Ruytha",
  site: "https://ruytha.dev",
  github: "https://github.com/Ruytha",
  avatar: MAKER_AVATAR,
  discord: "https://discord.gg/m9veFRXxDF",
  kofi: "https://ko-fi.com/ruytha",
};

export interface ReleaseItem {
  title: string;
  text: string;
}

export interface ForkRelease {
  /** The section heading, e.g. "2026-10-23". */
  name: string;
  items: ReleaseItem[];
  /** Changes whenever the section's text does, so an edited release counts as new. */
  key: string;
}

/** Markdown inline syntax down to plain text: links keep their label. */
function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function parse(): ForkRelease | null {
  const lines = changelog.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => line.startsWith("## "));
  if (start === -1) return null;
  let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  if (end === -1) end = lines.length;
  const section = lines.slice(start, end);

  // A bullet starts an item; its indented continuation lines belong to it.
  const bullets: string[] = [];
  for (const line of section) {
    if (line.startsWith("- ")) bullets.push(line.slice(2));
    else if (/^\s+\S/.test(line) && bullets.length) bullets[bullets.length - 1] += ` ${line.trim()}`;
  }
  const items = bullets.map((bullet) => {
    const match = bullet.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    return match
      ? { title: plain(match[1]).replace(/[.:]$/, ""), text: plain(match[2]) }
      : { title: "", text: plain(bullet) };
  });
  return { name: section[0].slice(3).trim(), items, key: hash(section.join("\n")) };
}

let cached: ForkRelease | null | undefined;
export function GetForkRelease(): ForkRelease | null {
  if (cached === undefined) cached = parse();
  return cached;
}

/** The community TTML database's index, reduced to what a lookup needs. No imports, so tests can load it. */

export type CommunityIndex = {
  /** Spotify track id → path of the TTML file, relative to the repository root. */
  spotify: Record<string, string>;
  isrc: Record<string, string>;
};

/**
 * Reduces the index to the two maps. Later lines are newer submissions (the file names
 * start with their upload time), so a later file for the same id replaces an earlier one.
 */
export function BuildCommunityIndex(jsonl: string): CommunityIndex {
  const index: CommunityIndex = { spotify: {}, isrc: {} };
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let entry: { metadata?: unknown; rawLyricFile?: unknown };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof entry.rawLyricFile !== "string" || !Array.isArray(entry.metadata)) continue;
    // Only plain file names: the path is appended to the repository root.
    if (!/^[\w.-]+\.ttml$/.test(entry.rawLyricFile)) continue;
    const path = `raw-lyrics/${entry.rawLyricFile}`;
    for (const pair of entry.metadata) {
      if (!Array.isArray(pair) || !Array.isArray(pair[1])) continue;
      const [key, values] = pair as [unknown, unknown[]];
      const target = key === "spotifyId" ? index.spotify : key === "isrc" ? index.isrc : null;
      if (!target) continue;
      for (const value of values) {
        if (typeof value !== "string" || !value.trim()) continue;
        target[key === "isrc" ? value.trim().toUpperCase() : value.trim()] = path;
      }
    }
  }
  return index;
}

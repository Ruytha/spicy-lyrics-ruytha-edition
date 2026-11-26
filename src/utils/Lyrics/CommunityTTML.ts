import { GetExpireStore } from "../../modules/Store.ts";
import { GetTrackMetadata } from "../API/SpotifyTrackMetadata.ts";
import Logger from "../Logger.ts";
import { getRemoteConfig } from "../remoteConfig.ts";
import { $communityLyrics } from "../stores.ts";
import { BuildCommunityIndex, type CommunityIndex } from "./CommunityIndex.ts";
import { ParseTTML } from "./manager/parseTTML.ts";

/**
 * Community TTML (setting): word-synced lyrics from the AMLL TTML DB, a public CC0
 * repository of hand-synced TTML files. Each file lists the platform ids and ISRCs of
 * the recordings it was synced to.
 *
 * The repository publishes an index of every file with its metadata. It is fetched
 * once, reduced to two maps (Spotify id → file, ISRC → file) and kept for
 * `communityLyrics.indexTtlHours`, so finding out whether a song has a file costs no
 * request at all. Matching by ISRC as well catches the same recording released under
 * other Spotify ids (singles, deluxe editions, regional copies).
 *
 * Without the index (it couldn't be fetched), the track's own id is tried directly
 * against the repository's per-Spotify-id folder.
 */

const logger = new Logger("Community TTML");

/** The `source` stamped on these lyrics, read by the credits and the bug report. */
export const COMMUNITY_SOURCE = "amll-db";

// The mirror serves the same repository when GitHub's raw host can't be reached.
const ROOTS = [
  "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/",
  "https://cdn.jsdelivr.net/gh/amll-dev/amll-ttml-db@main/",
];
const INDEX_PATH = "metadata/raw-lyrics-index.jsonl";

const IndexStore = GetExpireStore<CommunityIndex>("SpicyLyrics_CommunityTTMLIndex", 1, {
  Unit: "Hours",
  get Duration() {
    return getRemoteConfig().communityLyrics.indexTtlHours;
  },
});

let indexRequest: Promise<CommunityIndex | null> | null = null;
/** After a failed index fetch, when to try again. Until then the direct lookup is used. */
let indexRetryAt = 0;

/** Fetches `path` from the repository, trying the mirror when the first root fails outright. */
async function fetchFromRepo(path: string, timeoutMs: number): Promise<Response | null> {
  for (const root of ROOTS) {
    try {
      const res = await fetch(root + path, { signal: AbortSignal.timeout(timeoutMs) });
      // A 404 is an answer: the file isn't there, and the mirror won't have it either.
      if (res.ok || res.status === 404) return res;
      logger.debug(`${root} answered ${res.status} for ${path}`);
    } catch (error) {
      logger.debug(`${root} failed for ${path}`, error);
    }
  }
  return null;
}

async function loadIndex(): Promise<CommunityIndex | null> {
  try {
    const cached = await IndexStore.GetItem("index");
    if (cached?.spotify && cached.isrc) return cached;
  } catch (error) {
    logger.debug("Couldn't read the cached index", error);
  }
  if (Date.now() < indexRetryAt) return null;

  const { indexTimeoutMs, indexRetryMs } = getRemoteConfig().communityLyrics;
  const res = await fetchFromRepo(INDEX_PATH, indexTimeoutMs);
  if (!res?.ok) {
    indexRetryAt = Date.now() + indexRetryMs;
    logger.warn("Couldn't fetch the index, using direct lookups for now");
    return null;
  }
  try {
    const index = BuildCommunityIndex(await res.text());
    logger.debug(
      `Index loaded: ${Object.keys(index.spotify).length} Spotify ids, ${Object.keys(index.isrc).length} ISRCs`
    );
    IndexStore.SetItem("index", index).catch((error) => logger.debug("Couldn't cache the index", error));
    return index;
  } catch (error) {
    indexRetryAt = Date.now() + indexRetryMs;
    logger.warn("Couldn't read the index", error);
    return null;
  }
}

/** The index, shared by concurrent callers. A failed load is retried later, not kept. */
function getIndex(): Promise<CommunityIndex | null> {
  indexRequest ??= loadIndex().finally(() => {
    indexRequest = null;
  });
  return indexRequest;
}

// Files already fetched this session, so replaying a song doesn't fetch its file again.
const fileCache = new Map<string, string>();
const FILE_CACHE_LIMIT = 50;

async function fetchFile(path: string): Promise<string | null> {
  const cached = fileCache.get(path);
  if (cached !== undefined) return cached;
  const res = await fetchFromRepo(path, getRemoteConfig().communityLyrics.lyricsTimeoutMs);
  if (!res?.ok) return null;
  const text = await res.text();
  if (fileCache.size >= FILE_CACHE_LIMIT) fileCache.delete(fileCache.keys().next().value!);
  fileCache.set(path, text);
  return text;
}

/** The path of the file to try for this track, or null when the database has none. */
async function findPath(trackId: string): Promise<string | null> {
  const index = await getIndex();
  if (!index) return `spotify-lyrics/${trackId}.ttml`;
  if (Object.hasOwn(index.spotify, trackId)) return index.spotify[trackId];
  const isrc = (await GetTrackMetadata(trackId, getRemoteConfig().communityLyrics.lyricsTimeoutMs))?.isrc;
  if (isrc && Object.hasOwn(index.isrc, isrc)) return index.isrc[isrc];
  return null;
}

/**
 * Community lyrics for a Spotify track, parsed and stamped with their source, or null.
 * Never throws: a failure anywhere means no lyrics from here.
 */
export async function FindCommunityLyrics(trackId: string): Promise<any | null> {
  if ($communityLyrics.get() === "off" || !/^[A-Za-z0-9]{22}$/.test(trackId)) return null;
  try {
    const path = await findPath(trackId);
    if (!path) return null;
    const ttml = await fetchFile(path);
    if (!ttml) return null;
    const parsed = ParseTTML(ttml);
    if (!parsed) {
      logger.warn("File didn't parse", path);
      return null;
    }
    logger.debug("Found", { trackId, path, type: parsed.Type });
    return { ...parsed, source: COMMUNITY_SOURCE };
  } catch (error) {
    logger.warn("Lookup failed", error);
    return null;
  }
}

import { SpotifyFetch } from "../../components/Global/SpotifyFetch.ts";

/** What the extra lyrics sources need to know about a track to find its lyrics. */
export type TrackMetadata = {
  name: string;
  artists: string[];
  durationMs: number;
  isrc: string | null;
};

const cache = new Map<string, Promise<TrackMetadata | null>>();
const CACHE_LIMIT = 100;

/**
 * A track's name, artists, duration and ISRC, from Spotify's own track metadata.
 * Shared by concurrent callers; a failure isn't kept, so the next call asks again.
 */
export function GetTrackMetadata(trackId: string, timeoutMs: number): Promise<TrackMetadata | null> {
  const cached = cache.get(trackId);
  if (cached) return cached;
  const request = (async (): Promise<TrackMetadata | null> => {
    const hex = Spicetify.URI.idToHex(trackId);
    const res = await SpotifyFetch(`https://spclient.wg.spotify.com/metadata/4/track/${hex}?market=from_token`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      artist?: { name?: string }[];
      duration?: number;
      external_id?: { type?: string; id?: string }[];
    };
    if (typeof data.name !== "string") return null;
    return {
      name: data.name,
      artists: (data.artist ?? []).map((a) => a.name).filter((n): n is string => typeof n === "string"),
      durationMs: typeof data.duration === "number" ? data.duration : 0,
      isrc: data.external_id?.find((e) => e.type === "isrc")?.id?.toUpperCase() ?? null,
    };
  })().catch(() => null);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(trackId, request);
  request.then((data) => data === null && cache.delete(trackId));
  return request;
}

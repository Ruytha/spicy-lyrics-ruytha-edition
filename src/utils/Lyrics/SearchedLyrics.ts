import { GetTrackMetadata, type TrackMetadata } from "../API/SpotifyTrackMetadata.ts";
import Logger from "../Logger.ts";
import { getRemoteConfig } from "../remoteConfig.ts";
import { LrcToTTML, PickMatch, YrcToTTML, type SearchCandidate } from "./ExternalFormats.ts";
import { ParseTTML } from "./manager/parseTTML.ts";

/**
 * NetEase Cloud Music and QQ Music (settings): lyrics found by searching the service for
 * the playing track and keeping the result whose title, artist and length match it
 * (PickMatch). NetEase serves word-timed lyrics for many songs and LRC for most others;
 * QQ Music serves LRC. Both answer to the client's own requests only through Spicetify's
 * request proxy (`CosmosAsync`): their servers don't allow cross-origin `fetch`.
 */

const logger = new Logger("Searched Lyrics");

export const NETEASE_SOURCE = "netease";
export const QQ_SOURCE = "qqmusic";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)),
  ]);
}

const get = (url: string): Promise<any> =>
  withTimeout(Spicetify.CosmosAsync.get(url), getRemoteConfig().searchedLyrics.timeoutMs);

/** Title and first artist, without the parts services rarely carry ("- Remastered 2011", "(feat. …)"). */
function searchQuery(track: TrackMetadata): string {
  const title = track.name
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s*[([][^)\]]*\b(?:feat|ft|with|remaster|version|edit|mix|live)\b[^)\]]*[)\]]/gi, "")
    .trim();
  return [title || track.name, track.artists[0]].filter(Boolean).join(" ");
}

function parse(ttml: string | null, source: string): any | null {
  if (!ttml) return null;
  const parsed = ParseTTML(ttml);
  return parsed ? { ...parsed, source } : null;
}

async function findNetease(track: TrackMetadata): Promise<any | null> {
  const query = encodeURIComponent(searchQuery(track));
  const search = await get(`https://music.163.com/api/search/get?s=${query}&type=1&limit=10`);
  const songs: any[] = Array.isArray(search?.result?.songs) ? search.result.songs : [];
  const candidates: SearchCandidate<number>[] = songs.map((s) => ({
    name: String(s?.name ?? ""),
    artists: Array.isArray(s?.artists) ? s.artists.map((a: any) => String(a?.name ?? "")) : [],
    durationMs: Number(s?.duration) || 0,
    value: Number(s?.id),
  }));
  const id = PickMatch(track, candidates);
  if (!id) return null;
  const lyrics = await get(`https://music.163.com/api/song/lyric/v1?id=${id}&lv=1&yv=1&tv=0&rv=0`);
  const yrc = typeof lyrics?.yrc?.lyric === "string" ? lyrics.yrc.lyric : "";
  const lrc = typeof lyrics?.lrc?.lyric === "string" ? lyrics.lrc.lyric : "";
  return parse(YrcToTTML(yrc, track.name), NETEASE_SOURCE) ?? parse(LrcToTTML(lrc, track.name), NETEASE_SOURCE);
}

const musicu = (body: unknown) =>
  get(`https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify(body))}`);

function decodeBase64(text: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
}

async function findQQ(track: TrackMetadata): Promise<any | null> {
  const search = await musicu({
    comm: { ct: 11, cv: 0 },
    req: {
      module: "music.search.SearchCgiService",
      method: "DoSearchForQQMusicMobile",
      param: { query: searchQuery(track), num_per_page: 10, page_num: 1, search_type: 0 },
    },
  });
  const songs: any[] = Array.isArray(search?.req?.data?.body?.item_song) ? search.req.data.body.item_song : [];
  const candidates: SearchCandidate<{ mid: string; id: number }>[] = songs.map((s) => ({
    name: String(s?.name ?? s?.title ?? ""),
    artists: Array.isArray(s?.singer) ? s.singer.map((a: any) => String(a?.name ?? "")) : [],
    durationMs: (Number(s?.interval) || 0) * 1000,
    value: { mid: String(s?.mid ?? ""), id: Number(s?.id) },
  }));
  // The service gives lengths in whole seconds, so it gets a second more leeway.
  const song = PickMatch(track, candidates, 4000);
  if (!song?.mid) return null;
  const lyrics = await musicu({
    comm: { ct: 19, cv: 1859 },
    req: {
      module: "music.musichallSong.PlayLyricInfo",
      method: "GetPlayLyricInfo",
      param: { songMID: song.mid, songID: song.id, trans: 0, roma: 0, qrc: 0 },
    },
  });
  const encoded = lyrics?.req?.data?.lyric;
  if (typeof encoded !== "string" || encoded === "") return null;
  return parse(LrcToTTML(decodeBase64(encoded), track.name), QQ_SOURCE);
}

async function find(
  trackId: string,
  label: string,
  search: (track: TrackMetadata) => Promise<any | null>
): Promise<any | null> {
  if (!/^[A-Za-z0-9]{22}$/.test(trackId)) return null;
  try {
    const track = await GetTrackMetadata(trackId, getRemoteConfig().searchedLyrics.timeoutMs);
    if (!track) return null;
    const found = await search(track);
    logger.debug(found ? `${label}: found (${found.Type})` : `${label}: no match`, track.name);
    return found;
  } catch (error) {
    logger.warn(`${label} lookup failed`, error);
    return null;
  }
}

/** NetEase lyrics for a Spotify track, parsed and stamped with their source, or null. Never throws. */
export const FindNeteaseLyrics = (trackId: string) => find(trackId, "NetEase", findNetease);

/** QQ Music lyrics for a Spotify track, parsed and stamped with their source, or null. Never throws. */
export const FindQQLyrics = (trackId: string) => find(trackId, "QQ Music", findQQ);

import { openDB, type IDBPDatabase } from "idb";
import Logger from "./Logger";

const dbLogger = new Logger("Database");

export const ObjectStores = {
  LyricsStore: "lyricsStore",
}

export const LYRICS_DB_NAME = "spicylyrics";

/**
 * Opens `name` with its object stores in place, whatever version it is at.
 *
 * Other Spicy Lyrics builds use the same database and may have upgraded it past
 * version 1. Opening at a lower version than the one on disk fails every time, so a
 * newer database is opened at its current version, and the version is only raised when
 * one of our stores is missing.
 */
export async function openStores(
  name: string,
  stores: string[],
  onBlocking?: () => void
): Promise<IDBPDatabase> {
  const upgrade = (db: IDBPDatabase) => {
    for (const store of stores) {
      if (!db.objectStoreNames.contains(store)) {
        db.createObjectStore(store);
        dbLogger.debug("Created '", store, "' store in", name);
      }
    }
  };
  // Another build asking to upgrade: let go so it can, and reopen on the next use.
  const blocking = (db: IDBPDatabase) => () => {
    db.close();
    onBlocking?.();
  };

  // Version 1 first, as every build has always opened it, so a new database is created
  // at 1 and older builds can still open it. Only a database already past 1 falls through.
  try {
    const first: IDBPDatabase = await openDB(name, 1, { upgrade, blocking: () => blocking(first)() });
    if (stores.every((store) => first.objectStoreNames.contains(store))) return first;
    first.close();
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "VersionError")) throw error;
  }

  const current = await openDB(name);
  if (stores.every((store) => current.objectStoreNames.contains(store))) {
    current.addEventListener("versionchange", blocking(current));
    return current;
  }

  const version = current.version + 1;
  current.close();
  dbLogger.debug(`Upgrading ${name} from version ${version - 1} to ${version} to add missing stores`);
  const upgraded: IDBPDatabase = await openDB(name, version, {
    upgrade,
    blocking: () => blocking(upgraded)(),
  });
  return upgraded;
}

let lyricsDB: Promise<IDBPDatabase> | null = null;

/** The local lyrics database, opened on first use and reopened after it is closed. */
export function getLyricsDB(): Promise<IDBPDatabase> {
  lyricsDB ??= openStores(LYRICS_DB_NAME, [ObjectStores.LyricsStore], () => {
    lyricsDB = null;
  }).catch((error) => {
    lyricsDB = null;
    throw error;
  });
  return lyricsDB;
}

export async function ensurePersistence() {
  try {
    if (await navigator.storage.persisted()) return true;

    const granted = await navigator.storage.persist();
    if (!granted) {
      dbLogger.warn("Data persistence request was denied; This can lead to potential data loss")
    } else {
      dbLogger.debug("Data persistence request was accepted")
    }
    return granted;
  } catch (e) {
    dbLogger.warn("Persistence check failed")
    return false;
  }
}

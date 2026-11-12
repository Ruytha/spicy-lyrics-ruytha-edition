// Spicy Lyrics: Ruytha Edition loader. This is the file to install in Spicetify.
//
// It loads the build committed to this repository's main branch through jsDelivr.
// The newest commit is looked up first and the build is requested at that exact
// commit, because jsDelivr can serve a branch (`@main`) from cache for up to 12 hours.
// If GitHub can't be reached in time (offline, rate limited, slow), it falls back to `@main`.
//
// Spicetify sometimes fails partway through its own startup: Spotify loads, but
// Spicetify.ReactDOM is never set and its loaded events never fire, so no extension
// can render. A page reload clears it, so when that happens the loader reloads once
// per session; if Spicetify still isn't ready after that, it shows a notice instead.
(async () => {
  const REPO = "Ruytha/spicy-lyrics-ruytha-edition";
  const BUILD_PATH = "builds/ruytha/spicy-lyrics.js";
  const LOG = "[Spicy Lyrics: Ruytha Edition]";
  const LOOKUP_TIMEOUT_MS = 4000;
  const READY_TIMEOUT_MS = 20000;
  const RELOAD_KEY = "spicy-lyrics-ruytha:reloaded";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const notify = (text) => {
    try {
      window.Spicetify?.showNotification?.(text, true);
    } catch {
      // Nothing to show it with.
    }
  };
  const session = {
    get: () => {
      try {
        return sessionStorage.getItem(RELOAD_KEY);
      } catch {
        return "1"; // Can't remember a reload, so never start one.
      }
    },
    set: () => {
      try {
        sessionStorage.setItem(RELOAD_KEY, "1");
        return true;
      } catch {
        return false;
      }
    },
  };

  // Watch Spicetify finish starting up while the build downloads.
  const spicetifyReady = () => {
    const S = window.Spicetify;
    return !!(S?.React && S?.ReactJSX && S?.ReactDOM && S?.Platform && S?.Player);
  };
  const readiness = (async () => {
    const until = Date.now() + READY_TIMEOUT_MS;
    while (!spicetifyReady()) {
      if (Date.now() > until) return false;
      await sleep(250);
    }
    return true;
  })();

  let ref = "main";
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { Accept: "application/vnd.github.sha" },
      cache: "no-store",
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (res.ok) ref = (await res.text()).trim();
  } catch {
    // Keep "main".
  }

  // A failed import is cached by URL, so the retry asks for a fresh one.
  const load = (at, query = "") =>
    import(`https://cdn.jsdelivr.net/gh/${REPO}@${at}/${BUILD_PATH}${query}`);
  try {
    await load(ref);
  } catch (err) {
    console.warn(LOG, `Couldn't load the build at ${ref}, retrying from main`, err);
    try {
      await sleep(1500);
      await load("main", `?retry=${Date.now()}`);
    } catch (retryErr) {
      console.error(LOG, "Failed to load the extension", retryErr);
      notify("Spicy Lyrics couldn't be downloaded. Check your connection and restart Spotify.");
      return;
    }
  }

  if (await readiness) return;

  if (!session.get() && session.set()) {
    console.warn(LOG, "Spicetify didn't finish starting up; reloading once");
    location.reload();
    return;
  }
  console.error(LOG, "Spicetify didn't finish starting up, even after a reload");
  notify("Spicetify didn't finish loading, so Spicy Lyrics can't start. Restart Spotify.");
})();

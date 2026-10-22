// Spicy Lyrics: Ruytha Edition loader. This is the file to install in Spicetify.
//
// It loads the build committed to this repository's main branch through jsDelivr.
// The newest commit is looked up first and the build is requested at that exact
// commit, because jsDelivr can serve a branch (`@main`) from cache for up to 12 hours.
// If GitHub can't be reached (offline, rate limited), it falls back to `@main`.
(async () => {
  const REPO = "Ruytha/spicy-lyrics-ruytha-edition";
  const BUILD_PATH = "builds/ruytha/spicy-lyrics.js";

  let ref = "main";
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { Accept: "application/vnd.github.sha" },
      cache: "no-store",
    });
    if (res.ok) ref = (await res.text()).trim();
  } catch {
    // Keep "main".
  }

  try {
    await import(`https://cdn.jsdelivr.net/gh/${REPO}@${ref}/${BUILD_PATH}`);
  } catch (err) {
    console.error("[Spicy Lyrics: Ruytha Edition] Failed to load the extension", err);
  }
})();

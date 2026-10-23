# Changelog

Changes in **Spicy Lyrics: Ruytha Edition**, newest first. Everything not listed here
works the same as upstream [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics).

Installed copies update on their own the next time Spotify starts.

## 2026-10-23

### Added

- **Pulse to the Beat.** The lyrics page background swells and brightens on every beat,
  harder on confident beats in loud sections, then eases back. It follows Spotify's beat
  data for the song, works with every background style, and pauses with the music. Turn
  it off under Settings → Background → **Pulse to the Beat**; it also stays off when
  Windows' reduce-motion setting is on.
- **Profile viewer.** Clicking **Made by** or **Uploaded by** under the lyrics opens the
  maker's or uploader's Spicy Lyrics profile in a window inside Spotify instead of your
  browser. Their makes and uploads, views, search and sort are all there, and **Listen**
  plays a track straight away. Close it with Escape, the ✕, or by clicking outside it.
- **Back to current line.** When you scroll the lyrics away from the line that's playing,
  a button appears in the bottom-right corner to take you back. The arrow points towards
  the playing line. Works with both the Spicy and AMLL renderers, even while paused.
- **Clear this song's cache.** A trash button in the lyrics page's top controls removes
  the current song's cached lyrics and loads them again. Previously this was only in
  Settings → Advanced.
- **Ruytha theme.** Settings, dialogs and the lyrics page controls now use
  [ruytha.dev](https://ruytha.dev)'s night-sky colours, glass and fonts (Geist and
  Bricolage Grotesque). Lyrics keep Spicy's own look.
- **Starry Night background.** A new option under Settings → Background: a night sky with
  gently twinkling stars, matching ruytha.dev.

### Fixed

- The night-sky background showed up as a grid of squares in the settings window.

## 2026-10-22

### Changed

- **Updated to Spicy Lyrics 6.4.70**, which supports Spotify 1.3.6. Includes upstream's
  fixes for Spotify's newer Now Playing layout and Canvas videos, popup lyrics and
  fullscreen.
- **Installs through a self-updating loader.** Install `spicy-lyrics-ruytha.mjs` once and
  every new build reaches you on your next Spotify start, without reinstalling. See the
  [README](./README.md#installation).

### Added

- **AMLL background.** A new option under Settings → Background: a flowing mesh gradient
  made from the cover art. It follows the Limit Frame Rate setting, slows down while
  paused, stops while Spotify is minimized, and falls back to Dynamic (Kawarp) if WebGL
  isn't available. **AMLL Flow Speed** and **AMLL Still Mode** settings sit underneath it.
- **AMLL lyrics renderer.** Settings → Lyrics → Lyrics Renderer → **AMLL** draws synced
  lyrics with AMLL's lyric player: word-by-word fill, blur on nearby lines and spring
  scrolling. It works in every view (lyrics page, fullscreen, the Now Playing card and
  popup), and supports click-to-seek, duets, background vocals, romanization and your
  sync offset. Songwriters, the lyrics provider and community sync credits show under the
  last line. Unsynced lyrics still use Spicy's renderer.

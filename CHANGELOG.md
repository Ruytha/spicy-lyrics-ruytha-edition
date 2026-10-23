# Changelog

Changes in **Spicy Lyrics: Ruytha Edition**, newest first. Everything not listed here
works the same as upstream [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics).

Installed copies update on their own the next time Spotify starts, and the first start
after an update shows what's new.

## 2026-10-23, third update

### Added

- **Canvas on every background.** Canvas Stage, the song's Spotify Canvas filling the
  cover's half of the page, now works with AMLL, Starry Night and the image and color
  styles too, not only Dynamic.
- **Apple Music animated covers.** Settings → Cover → **Moving Artwork** → Apple Music
  Cover plays an album's animated cover from Apple Music inside the cover square, for
  albums that have one (After Hours, for one). Albums without one keep the still cover.
- **Cover Only.** Hides the lyrics and shows the cover large in the middle of the page.
  Turn it on with the new button on the lyrics page, the C key, or Settings → Cover.
- **Cover moves to the beat.** Settings → Cover → **Move to the Beat** makes the cover
  swell on each beat, like the background.
- **Melt into Background.** Settings → Cover drops the cover's frame and fades its edges
  into the background.
- **Render controls.** Settings → Background → Render has Bloom, Brightness, Saturation
  and Contrast for the background, and a Render Quality choice for AMLL.
- **Lyric Glow.** Settings → Lyrics sets how much sung words glow, from off to 250%.
- **Fonts.** Settings → Appearance → **Font** offers Spicy Lyrics, Spotify's font, SF Pro,
  Geist, Inter, Bricolage Grotesque and Poppins, or any Google Fonts name under Custom.

### Changed

- **Settings redesign.** Each section has its own coloured icon, there's a new Cover
  section, every page opens with a line on what's in it, and About leads with who makes
  the fork.
- **New lyrics page controls.** The buttons are now one glass dock in three groups (view,
  lyrics, settings), with a new icon set drawn for the fork. A switch that's on shows a
  dot under its icon, and Close is a down arrow that puts the page away.
- **About** now links to Ruytha's website, Discord and Ko-fi.

## 2026-10-23, second update

### Added

- **Spotlight on Ruytha's syncs.** Songs synced by Ruytha, who makes this fork, greet
  you with a banner, send shooting stars across the background on the beat, and ring
  Ruytha's name in the credits. Turn it off under Settings → Background → **Spotlight
  Ruytha's Syncs**.
- **What's new.** After the fork updates, the first Spotify start shows the newest
  changes from this changelog, once.
- **AMLL lyric options.** Settings → Lyrics → AMLL Lyrics can turn off the blur on other
  lines, the springy motion and the enlarged playing line, hide lines once they're sung,
  and move the playing line to the middle of the page.
- **Pulse Strength.** Choose Subtle, Normal or Strong for Pulse to the Beat under
  Settings → Background.
- **Timing overlay.** For syncers: Settings → Lyrics → For Syncers → **Timing Overlay**
  shows the playback time to the millisecond, with the start and end of the line and
  word playing. Click it to copy the time.
- **Report a bug.** Settings → About has a button that opens a new GitHub issue for the
  fork with your versions and main settings filled in. Nothing is sent until you submit
  it.
- **Back to the current line with L.** Press L on the lyrics page to jump back to the
  line playing, same as the button.

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

# Changelog

Changes in **Spicy Lyrics: Ruytha Edition**, newest first. Everything not listed here
works the same as upstream [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics).

Installed copies update on their own the next time Spotify starts, and the first start
after an update shows what's new.

## 2026-10-30

### Added

- **Cover Only for songs without lyrics.** When a song has no lyrics, the page shows its
  cover large in the middle, the way Cover Only does, instead of a notice. The lyrics come
  back with the next song that has them. Turn it off under Settings → Cover → **Cover Only
  for Songs Without Lyrics**.

### Changed

- **New player controls in Cinema View and fullscreen.** The controls used to sit on top of
  the cover: a big heart in the middle, the buttons along its bottom edge and the volume
  down its side. They now sit under the cover like a music player: the title, the
  timeline, shuffle, skip and repeat around a solid play button, then the heart beside a
  flat volume slider. The cover stays clear. When the mouse rests, the timeline and
  controls fold away and the cover grows back, leaving just the cover and the title;
  moving the mouse brings them back. Compact mode, the popup and Canvas Stage keep their
  own layouts.

## 2026-10-29, second update

### Changed

- **Profile card.** Clicking **Made by** or **Uploaded by** opens a window that starts with
  a card for that person: their picture, name and role, and **Open profile**, which opens
  their full profile on spicylyrics.org in your browser. spicylyrics.org is retiring the
  embedded profile page; while it lasts it shows under the card, and once it's gone the
  card stays.

### Fixed

- With themes that paint every popup solid (GlassHome, for one), holding the eye button in
  Settings turned the window into a grey box instead of showing the lyrics. Spicy Lyrics'
  windows and the controls menu now keep their own look under those themes.

## 2026-10-29

### Added

- **Tame Impala mode.** Songs by Tame Impala, featuring them, or written by Kevin Parker
  get the look of the Currents cover: thin violet-to-orange lines flow across the
  background and bend around a slowly drifting sphere, rippling harder on each beat. The
  playing lyric splits into magenta and cyan like a psychedelic print, and a banner says
  so when the song starts. Turn it off under Settings → Background → **Tame Impala Mode**.

### Changed

- **Smoother scrolling with AMLL.** The mouse wheel used to move AMLL's lyrics a whole
  notch at once and let them spring after it, so they trailed the wheel and wobbled to a
  stop. Now they glide straight to where the wheel puts them, following it closely.
- **A light spring on the interface.** Settings and other windows, the lyrics page
  controls and their menu, the cover sliding in and swapping sides, the back-to-the-line
  button and the arrival banners now settle with a slight spring. With Windows'
  reduce-motion setting on they keep the plain ease.

### Fixed

- **Lyrics stay in time after Cover Only.** Turning Cover Only off could leave the lyrics
  out of sync, with the playing line in the wrong place or highlighting at the wrong
  moment. They're drawn afresh when they come back, with either renderer.
- Skipping from a Tame Impala song to another song could leave Tame Impala mode on for
  the new one. It now turns off unless the new song is theirs too.

## 2026-10-28

### Fixed

- **Apple Music Look keeps your Spotify Canvas.** It used to switch Canvas off. Now albums
  with an Apple Music animated cover play that, and every other song keeps its Canvas. If
  the look already turned your Canvas off, set Settings → Cover → Moving Artwork back to
  **Spotify Canvas**.
- Settings → Experiments said Canvas Stage only works with the Dynamic background. It
  works with every background except None, and the note now says so.

## 2026-10-27, second update

### Added

- **Load a TTML file in one click.** With TTML Maker Mode on, the lyrics page controls have
  **Load TTML File**: pick a .ttml and it shows on the playing song right away, without
  saving it to the Local Lyrics DB. Dropping a .ttml on the lyrics or pasting one with
  Ctrl+V does the same.
- **Temporary lyrics are marked.** While a TTML loaded just for now is showing, a badge in
  the lyrics' top corner says so, and its **Revert** button brings the song's own lyrics
  back. Otherwise they come back the next time the song plays.
- **Crashes in Copy Debug Info.** The copied debug info now also lists the latest uncaught
  errors, with where they happened, so bug reports show what broke.

### Changed

- **Smoother beat-driven background.** The background's speed now follows each beat closely
  instead of catching only some of them, so the kick on every beat is clear.

### Fixed

- With Prefer the Animated Cover on, an album whose animated cover failed to load showed a
  still cover. It shows the song's Canvas instead now.

## 2026-10-27

### Added

- **Controls menu.** The lyrics page buttons fold behind one glass button that opens a
  menu, one labelled row per action, with a tick on the ones that are on. It opens
  toward whichever side has room, and closes on a click outside or Escape. Settings →
  Experiments → **Controls Menu** brings the row of buttons back.
- **Single Line Mode.** Settings → Lyrics → **Single Line Mode** shows only the line being
  sung and hides the rest, leaving the screen empty between lines. Unsynced lyrics still
  show in full.
- **Prefer the Animated Cover.** With Moving Artwork set to Spotify Canvas, Settings →
  Cover → **Prefer the Animated Cover** plays an album's Apple Music animated cover
  instead of the song's Canvas. Songs from albums without one keep their Canvas.
- **Copy Debug Info.** Settings → Advanced → **Copy Debug Info** copies versions, settings,
  the playing song and recent errors, to paste into a bug report. Nothing is sent
  anywhere and no account details are included.

### Changed

- **The background moves with the beat.** It speeds up on each beat and drifts slower in
  between, so its motion follows the music. Settings → Experiments → **Beat-Driven
  Background Motion** turns it off.

### Fixed

- Duet lines from TTML files sat on the main side. Lines sung by the second singer (v2)
  now go on the duet side, in line-synced files too, and in files that don't list their
  singers.
- Holding the eye button in Settings didn't show the lyrics behind the panel; the starry
  background stayed in front.

## 2026-10-24

### Added

- **Middle-click scrolling.** Press the mouse wheel on the lyrics and move the pointer up
  or down to scroll, faster the further it goes, like in a browser. A quick click keeps
  it going until the next click; holding and dragging stops on release.
- **Fonts from a file.** Settings → Appearance → Font → **From a File** uses a .ttf, .otf,
  .woff or .woff2 you pick, without installing it on the computer. The Custom font field
  also takes more installed-font names now.

### Changed

- **Settings icons in one colour.** The section icons all use the theme's blue.

### Fixed

- Cover Only in Cinema View and fullscreen hid the lyrics but left the cover in its
  corner. It now moves to the middle and grows, like on the normal page.
- Turning Cover Only on or off sent the cover sliding to the left when it was on the
  right. It keeps its side now.
- The back-to-the-line button sat over the player controls when the cover was on the
  right; it moves to the left corner then. It also hides while the lyrics are hidden.
- Popup Lyrics showed Spotify's font instead of the one picked in Settings.
- Popup Lyrics' AMLL background and Apple Music covers stopped while Spotify's main window
  was hidden.

## 2026-10-23, fourth update

### Added

- **Apple Music look.** Settings → Appearance → **Apple Music Look** sets up AMLL lyrics
  and background, Apple Music animated covers, the melted cover and SF Pro in one click.
  The message that pops up has an Undo.
- **Background follows the cover.** While an Apple Music animated cover plays, the page
  background is drawn from it, so the whole page moves with the artwork. Settings →
  Cover → **Background Follows the Cover**.
- **Lyric Glow for AMLL.** With the AMLL renderer, the playing line now glows softly too,
  following the Lyric Glow slider.
- **Reset a tab.** Each settings tab has a button at the bottom that puts its settings
  back to their defaults, after a second click to confirm.
- **Back up and restore settings.** Settings → Advanced → Backup saves every setting to a
  file and loads it back, for keeping or moving to another computer.

### Changed

- **Apple Music covers match exactly.** Albums are found on Apple Music by their barcode,
  in your own country's store first, so deluxe editions and albums outside the US find
  their cover. A light sweeps across the cover while one loads for the first time.

### Fixed

- The timing overlay covered the player controls in Cinema View, fullscreen and the
  popup. It now sits in the top-right corner there.

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

# Trying a change in Spotify

`spotify.ts` drives the Spotify desktop app over Chrome's debugging protocol, so a build
can be tried without clicking around. Windows only (it finds Spotify under `%APPDATA%`).

1. Start Spotify with the debugging port open. Close it first, then:

   ```
   "%APPDATA%\Spotify\Spotify.exe" --remote-debugging-port=8088 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling
   ```

   The last three keep Spotify drawing while it's behind other windows or minimized.
   Without them a hidden Spotify stops drawing: the lyrics stay blank, animations stall,
   screenshots come out empty, and a reload can even leave Spicetify unstarted.

2. Build and put the build in place of the release:

   ```
   bun run build
   bun tests/spotify/spotify.ts install
   bun tests/spotify/spotify.ts reload
   ```

3. Try things:

   ```
   bun tests/spotify/spotify.ts play Bling-Bang-Bang-Born
   bun tests/spotify/spotify.ts lyrics
   bun tests/spotify/spotify.ts ttml tests/fixtures/background-and-translations.ttml
   bun tests/spotify/spotify.ts seek 26
   bun tests/spotify/spotify.ts shot shot.png
   ```

   `ttml` shows the file on the playing song only until it plays again; nothing is saved
   to the Local Lyrics DB. `eval` runs any JavaScript in Spotify, with `Spicetify` and
   `window.SpicyLyrics` available.

4. Go back to the release:

   ```
   bun tests/spotify/spotify.ts restore
   bun tests/spotify/spotify.ts reload
   ```

Run `bun test` for the tests that don't need Spotify: the TTML parser, romaji word gaps,
and a check that the parts of AMLL the AMLL renderer leans on are still there (worth
running after updating `@applemusic-like-lyrics/core`).

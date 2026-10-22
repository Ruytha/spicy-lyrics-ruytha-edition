# Spicy Lyrics: Ruytha Edition

A fork of [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) by Spikerko that adds the [AMLL](https://github.com/amll-dev/applemusic-like-lyrics) background and lyric player as options. Everything else works the same as upstream Spicy Lyrics.

> [!NOTE]
> This is an unofficial fork. It isn't affiliated with or supported by the Spicy Lyrics team, so please don't report problems with this fork in the Spicy Lyrics Discord. Use this repository's [issues](https://github.com/Ruytha/spicy-lyrics-ruytha-edition/issues) instead.

Based on Spicy Lyrics **6.4.50**, which supports Spotify **1.3.6**.

## What this fork adds

| Setting | Where | What it does |
|---------|-------|--------------|
| **Background → AMLL** | Settings → Background | A flowing mesh gradient made from the cover art. Falls back to Dynamic (Kawarp) if WebGL isn't available. |
| **AMLL Flow Speed** | Settings → Background | How fast the AMLL background moves (0.25×–4×). It still slows down while playback is paused. |
| **AMLL Still Mode** | Settings → Background | Draws each cover once and holds it still, to save GPU. |
| **Lyrics Renderer → AMLL** | Settings → Lyrics → Style | Draws synced lyrics with AMLL's lyric player instead of Spicy's renderer: word-by-word fill, blur on nearby lines, and spring scrolling. |

Notes:

- Both are off by default. Spicy's own background and renderer stay the default.
- The AMLL lyric player is used for word-synced and line-synced lyrics in every view (lyrics page, fullscreen, the Now Playing sidebar card and popup). Static (unsynced) lyrics always use Spicy's renderer.
- With the AMLL renderer, songwriters, the lyrics provider and community sync credits show under the last line, the same as in Spicy's renderer.
- Simple Lyrics Mode and Minimal Lyrics Mode only affect Spicy's renderer.
- The AMLL background follows Spicy's **Limit Frame Rate** setting (Appearance → Performance), drops to 15 FPS while paused, and stops while Spotify is minimized.
- The Now Playing sidebar background always uses Dynamic (Kawarp), as in upstream.

## Installation

This fork isn't on the Spicetify Marketplace. You build it from source and add it to Spicetify yourself.

You need [Spicetify](https://spicetify.app/docs/getting-started), [Bun](https://bun.sh) and [Git](https://git-scm.com).

> [!IMPORTANT]
> Remove the Marketplace version of Spicy Lyrics, and any other Spicy Lyrics extension, first. Two copies running at once fight over the same lyrics page and settings.

```bash
git clone https://github.com/Ruytha/spicy-lyrics-ruytha-edition.git
cd spicy-lyrics-ruytha-edition
bun install
bun run build
```

Then copy `dist/spicy-lyrics.js` into your Spicetify Extensions folder ([where to find it](https://spicetify.app/docs/customization/extensions#manual-installation)) and run:

```bash
spicetify config extensions spicy-lyrics.js
spicetify apply
```

To update, pull the latest changes, build again, copy the new file over the old one, and run `spicetify apply`.

> [!NOTE]
> `builds/spicy-lyrics.mjs` in this repository is upstream's loader, which downloads the official Spicy Lyrics. It doesn't contain this fork's changes, so don't install that file.

### Turning the AMLL options on

1. Open Spicy Lyrics' settings (the gear on the lyrics page).
2. **Background** → set **Background** to **AMLL**.
3. **Lyrics** → set **Lyrics Renderer** to **AMLL**.

## Troubleshooting

**The Spicy Lyrics button doesn't appear after restarting Spotify.** Play or skip a song. Spicy Lyrics sets up its button on the first song change, and Spotify doesn't always send one for the track it restores at startup.

**The AMLL options aren't in the settings.** Another copy of Spicy Lyrics is probably loading too. Check which extensions are enabled in `config-xpui.ini` (`spicetify -c` prints its path), remove any other Spicy Lyrics entry by adding `-` to the end of its name (`spicetify config extensions name.mjs-`), then run `spicetify refresh -e`.

**The background is Kawarp even with AMLL selected.** WebGL couldn't start. Open Spotify's DevTools console and look for an `(AMLL Background)` warning.

For everything else (lyrics sources, sync issues, TTML uploads, the FAQ), see the [upstream README](https://github.com/Spikerko/spicy-lyrics#readme) and the [Spicy Lyrics guides](https://guides.spicylyrics.org/s/guides). Check that a problem also happens in upstream Spicy Lyrics before reporting it there.

## Development

```bash
bun install
bun run dev    # watch mode: rebuilds and syncs to Spicetify
bun run build
bun run lint
bun run fmt
```

The AMLL code is in:

- `src/components/DynamicBG/AMLLBackground.ts`: the AMLL background renderer
- `src/utils/Lyrics/Applyer/AMLL.ts`: the AMLL lyric player
- `src/components/DynamicBG/dynamicBackground.ts` and `src/utils/Lyrics/Global/Applyer.ts`: where each one is chosen

## Credits

- [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) by Spikerko and contributors. Support the original project on [Ko-fi](https://ko-fi.com/spikerko).
- [AMLL (Apple Music-like Lyrics)](https://github.com/amll-dev/applemusic-like-lyrics) (`@applemusic-like-lyrics/core`), which provides the background and lyric player.
- Lyrics and sync credits come from the Spicy Lyrics community and its lyric providers.

## License

[AGPL-3.0](./LICENSE), the same as upstream Spicy Lyrics and AMLL. The hosted services, databases and websites behind Spicy Lyrics are separate and aren't covered by this license.

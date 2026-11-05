# Test lyrics

Small made-up TTML files, one per feature, for the tests here and for trying a feature in
Spotify. To see one there, play any song and run
`bun tests/spotify/spotify.ts ttml tests/fixtures/<file>` (see `tests/spotify/README.md`),
or with TTML Maker Mode on use the **Load TTML File** button by the lyrics. Either way it
applies to that song only until it plays again.

- `background-and-translations.ttml`: a line with two background vocals (each gets its
  own row on AMLL), translations from the head (`<translations>`), and an inline
  `x-translation` that wins over the head one.

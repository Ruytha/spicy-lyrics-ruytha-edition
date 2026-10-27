/*
 * The Ruytha Edition's lyrics page controls (the dock in RuythaDock.css). Their own set,
 * not Spicy's: 24×24, a 1.6 stroke with round ends, drawn to sit optically centred, and
 * each one shows the thing it does rather than the page's layout.
 */

const Glyph = (body: string) =>
  `<svg class="NoFill SL_DockGlyph" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const DockIcons = {
  // A screen with a play mark: Cinema View.
  CinemaView: Glyph(`<rect x="2.75" y="5" width="18.5" height="13" rx="3.25"/><path d="M10.25 9.25v4.5l3.9-2.25z"/><path d="M8 21h8"/>`),
  // Corners pointing out, then in.
  Fullscreen: Glyph(`<path d="M4 9V5.75C4 4.78 4.78 4 5.75 4H9"/><path d="M15 4h3.25C19.22 4 20 4.78 20 5.75V9"/><path d="M20 15v3.25c0 .97-.78 1.75-1.75 1.75H15"/><path d="M9 20H5.75C4.78 20 4 19.22 4 18.25V15"/>`),
  CloseFullscreen: Glyph(`<path d="M9 4v3.25C9 8.22 8.22 9 7.25 9H4"/><path d="M20 9h-3.25C15.78 9 15 8.22 15 7.25V4"/><path d="M15 20v-3.25c0-.97.78-1.75 1.75-1.75H20"/><path d="M4 15h3.25c.97 0 1.75.78 1.75 1.75V20"/>`),
  // Lines drawing together, or apart.
  EnableCompactMode: Glyph(`<path d="M5 7.5h14"/><path d="M5 16.5h14"/><path d="m9.5 3 2.5 2.5L14.5 3"/><path d="m9.5 21 2.5-2.5 2.5 2.5"/>`),
  DisableCompactMode: Glyph(`<path d="M5 12h14"/><path d="m9.5 7.5 2.5-2.5 2.5 2.5"/><path d="m9.5 16.5 2.5 2.5 2.5-2.5"/>`),
  // A Latin letter beside a kana stroke: romanization.
  Romanization: Glyph(`<path d="M3.5 18 7.75 6l4.25 12"/><path d="M5.1 13.75h5.3"/><path d="M14.5 7.5h6"/><path d="M17.75 5.5c0 6-1.4 10.4-4 12.5"/><path d="M16 12.25c2 .6 3.6 2.6 4.5 5.25"/>`),
  // A panel with the cover square in it: the cover side.
  NowBar: Glyph(`<rect x="2.75" y="4" width="18.5" height="16" rx="3.25"/><path d="M10 4v16"/><rect x="4.75" y="8" width="3.25" height="3.25" rx=".8"/>`),
  // Two arrows trading places.
  NowBarSideSwap: Glyph(`<path d="M4.5 8.5h14"/><path d="m15 5 3.5 3.5L15 12"/><path d="M19.5 15.5h-14"/><path d="m9 12-3.5 3.5L9 19"/>`),
  // A page with lines and a pen: the lyrics manager.
  LyricsManager: Glyph(`<path d="M13 3.5H7.25A2.25 2.25 0 0 0 5 5.75v12.5a2.25 2.25 0 0 0 2.25 2.25h4.25"/><path d="M8.5 8h6"/><path d="M8.5 11.5h4"/><path d="m14.5 20.5.5-2.75 5.25-5.25a1.6 1.6 0 0 1 2.25 2.25l-5.25 5.25z"/>`),
  // A page with an arrow coming up into it: load a TTML file for now.
  LoadTTML: Glyph(`<path d="M13.5 3.5H7.25A2.25 2.25 0 0 0 5 5.75v12.5a2.25 2.25 0 0 0 2.25 2.25h9.5A2.25 2.25 0 0 0 19 18.25V9"/><path d="M13.5 3.5V7a2 2 0 0 0 2 2H19"/><path d="M13.5 3.5 19 9"/><path d="M12 17.5v-6"/><path d="m9.5 14 2.5-2.5 2.5 2.5"/>`),
  // A record in its sleeve: Cover Only.
  CoverOnly: Glyph(`<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>`),
  // A turning arrow: drop the cached lyrics and load them again.
  ClearCache: Glyph(`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.75 3.75v3.5h-3.5"/>`),
  // Mixer sliders: settings.
  Settings: Glyph(`<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>`),
  // Down chevron: put the page away, like closing Apple Music's player.
  Close: Glyph(`<path d="m6 9.5 6 6 6-6"/>`),
  // Three dots: the rest of the controls, folded into a menu.
  More: Glyph(`<circle cx="6" cy="12" r="1.75" fill="currentColor"/><circle cx="12" cy="12" r="1.75" fill="currentColor"/><circle cx="18" cy="12" r="1.75" fill="currentColor"/>`),
  // A tick beside a menu row that is switched on.
  Check: Glyph(`<path d="m5.5 12.5 4.25 4.25L18.5 7.5"/>`),
};

// The fork's page-wide options: the font, the background render controls (brightness,
// saturation, contrast, bloom), the lyric glow, and the cover's looks (beat, melt, Cover
// Only). Each is a class or a custom property on the lyrics page, which the CSS reads.
import "../../css/RuythaPage.css";
import Global from "../../components/Global/Global.ts";
import { PageContainer } from "../../components/Pages/PageView.ts";
import { OpenNowBar } from "../../components/Utils/NowBar.ts";
import { $isNowBarOpen } from "../uiState.ts";
import { SyncNoLyricsLayout } from "../Lyrics/LyricsNotice.ts";
import {
  $bgBloom,
  $bgBrightness,
  $bgContrast,
  $bgSaturation,
  $coverBeatPulse,
  $coverBlend,
  $coverOnlyMode,
  $customFontName,
  $fontFileVersion,
  $lyricGlow,
  $lyricsFont,
  $skipSpicyFont,
  type LyricsFont,
} from "../stores.ts";
import { FONT_FILE_FAMILY, RegisterFontFile } from "./FontFile.ts";

const GOOGLE_FONTS = "https://fonts.googleapis.com/css2";

// Family stacks for the built-in choices. Geist and Bricolage already load for the theme.
const FONT_STACKS: Partial<Record<LyricsFont, { family: string; load?: string }>> = {
  sf: { family: `"SF Pro Display", "SF Pro Text", -apple-system, "Segoe UI Variable Display", "Segoe UI"` },
  geist: { family: `"Geist"` },
  inter: { family: `"Inter"`, load: "Inter" },
  bricolage: { family: `"Bricolage Grotesque"` },
  poppins: { family: `"Poppins"`, load: "Poppins" },
};

const loadedFonts = new Map<string, Promise<boolean>>();
// The CSS of each Google font loaded, by name, to copy into Popup Lyrics' window too.
const fontCss = new Map<string, string>();

function addFontCss(doc: Document, name: string, css: string) {
  if ([...doc.querySelectorAll<HTMLStyleElement>("style[data-sl-font]")].some((s) => s.dataset.slFont === name)) return;
  const style = doc.createElement("style");
  style.dataset.slFont = name;
  style.textContent = css;
  doc.head.append(style);
}

/**
 * Every font the page can use, in `doc`: the Google fonts loaded so far, the theme's own
 * (Geist and Bricolage), and the font file. Popup Lyrics opens its own window, which only
 * gets Spicy's stylesheets, so it calls this; so does applyFont, for a change while it's open.
 */
export function InstallFontsIn(doc: Document) {
  if (doc === document) return;
  for (const [name, css] of fontCss) addFontCss(doc, name, css);
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href^="https://fonts.googleapis.com"]')) {
    if (doc.querySelector(`link[href="${CSS.escape(link.href)}"]`)) continue;
    const copy = doc.createElement("link");
    copy.rel = "stylesheet";
    copy.href = link.href;
    doc.head.append(copy);
  }
  if ($lyricsFont.get() === "file") void RegisterFontFile(doc);
}

/**
 * Load a Google Fonts family. Tries the weights the lyrics use, then the family's
 * default, since Google refuses the whole request when one weight doesn't exist.
 * Resolves false when Google doesn't have it (it may still be installed locally).
 */
function loadGoogleFont(name: string): Promise<boolean> {
  const cached = loadedFonts.get(name);
  if (cached) return cached;
  const family = encodeURIComponent(name.trim()).replace(/%20/g, "+");
  const request = (async () => {
    for (const url of [
      `${GOOGLE_FONTS}?family=${family}:wght@400;500;600;700;800;900&display=swap`,
      `${GOOGLE_FONTS}?family=${family}:wght@400;700&display=swap`,
      `${GOOGLE_FONTS}?family=${family}&display=swap`,
    ]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const css = await res.text();
        fontCss.set(name, css);
        addFontCss(document, name, css);
        if (PageContainer) InstallFontsIn(PageContainer.ownerDocument);
        return true;
      } catch {
        // Offline or blocked: the next URL won't fare better.
        return false;
      }
    }
    return false;
  })();
  loadedFonts.set(name, request);
  return request;
}

/**
 * Whether the name can go in a quoted CSS family. Installed fonts have all sorts of names
 * ("Gotham Rounded Bk", "Neue Haas Grotesk Display Pro 55 Rg"); only the characters that
 * could end the quoted string or the declaration are turned away.
 */
const isSafeFamilyName = (name: string) => /^[^"'\\;{}<>]{1,80}$/u.test(name.trim());

function applyFont(page: HTMLElement) {
  const font = $lyricsFont.get();
  let family: string | null = null;
  if (font === "file") {
    family = `"${FONT_FILE_FAMILY}"`;
    void RegisterFontFile(document);
    void RegisterFontFile(page.ownerDocument);
  } else if (font === "custom") {
    const name = $customFontName.get().trim();
    if (name && isSafeFamilyName(name)) {
      family = `"${name}"`;
      void loadGoogleFont(name);
    }
  } else {
    const stack = FONT_STACKS[font];
    if (stack) {
      family = stack.family;
      if (stack.load) void loadGoogleFont(stack.load);
    }
  }
  InstallFontsIn(page.ownerDocument);
  page.classList.toggle("UseSpicyFont", font === "spicy" || (font === "custom" && !family));
  page.classList.toggle("SL_CustomFont", !!family);
  if (family) page.style.setProperty("--sl_font", family);
  else page.style.removeProperty("--sl_font");
}

function applyRender(page: HTMLElement) {
  const pct = (v: number) => (Math.max(0, v) / 100).toFixed(2);
  page.style.setProperty(
    "--sl_bg-tune",
    `brightness(${pct($bgBrightness.get())}) saturate(${pct($bgSaturation.get())}) contrast(${pct($bgContrast.get())})`
  );

  const bloom = Math.max(0, Math.min(100, $bgBloom.get())) / 100;
  page.classList.toggle("SL_HasBloom", bloom > 0);
  page.style.setProperty("--sl_bloom", bloom.toFixed(2));
  const contentBox = page.querySelector<HTMLElement>(".ContentBox");
  if (bloom > 0 && contentBox && !contentBox.querySelector(":scope > .SL_Bloom")) {
    const layer = document.createElement("div");
    layer.className = "SL_Bloom";
    layer.setAttribute("aria-hidden", "true");
    contentBox.prepend(layer);
  }

  // The glow's strength follows the setting; its spread grows half as fast, so a strong
  // glow stays readable instead of smearing.
  const glow = Math.max(0, $lyricGlow.get()) / 100;
  page.style.setProperty("--sl_glow", glow.toFixed(2));
  page.style.setProperty("--sl_glow-size", (1 + (glow - 1) * 0.5).toFixed(2));
  page.classList.toggle("SL_NoGlow", glow === 0);
}

function applyCover(page: HTMLElement) {
  page.classList.toggle("SL_CoverBeat", $coverBeatPulse.get());
  page.classList.toggle("SL_CoverBlend", $coverBlend.get());
  const coverOnly = $coverOnlyMode.get();
  page.classList.toggle("SL_CoverOnly", coverOnly);
  // Cover Only is the cover; it needs the side that shows it.
  if (coverOnly && !$isNowBarOpen.get()) OpenNowBar(true);
  SyncNoLyricsLayout();
}

function applyAll() {
  const page = PageContainer;
  if (!page) return;
  applyFont(page);
  applyRender(page);
  applyCover(page);
}

const withPage = (apply: (page: HTMLElement) => void) => () => {
  if (PageContainer) apply(PageContainer);
};

Global.Event.listen("page:open", applyAll);
$lyricsFont.listen(withPage(applyFont));
$customFontName.listen(withPage(applyFont));
$fontFileVersion.listen(withPage(applyFont));
// The old switch still works for anyone who reaches it some other way.
$skipSpicyFont.listen((skip) => $lyricsFont.set(skip ? "system" : "spicy"));
for (const store of [$bgBrightness, $bgSaturation, $bgContrast, $bgBloom, $lyricGlow]) {
  store.listen(withPage(applyRender));
}
for (const store of [$coverBeatPulse, $coverBlend, $coverOnlyMode]) {
  store.listen(withPage(applyCover));
}

/** Flip Cover Only (the view control button and the C key). */
export function ToggleCoverOnly() {
  $coverOnlyMode.set(!$coverOnlyMode.get());
}

// C on the lyrics page flips Cover Only, same as the button. Not while typing.
document.addEventListener("keydown", (e) => {
  if (e.key !== "c" && e.key !== "C") return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !PageContainer?.isConnected) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return;
  ToggleCoverOnly();
});

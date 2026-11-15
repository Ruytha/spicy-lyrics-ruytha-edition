import { createTooltip } from "../../utils/tooltip.ts";
import fetchLyrics, { HoldsTemporaryUpload, ShowQueueLoader } from "../../utils/Lyrics/fetchLyrics.ts";
import { LyricsQueueRetry } from "../../utils/Lyrics/LyricsQueueRetry.ts";
import { SkeletonMarkup } from "../../utils/Lyrics/LyricsSkeleton.ts";
import { $forceCompactMode, $romanization } from "../../utils/uiState.ts";
import "../../css/Loaders/DotLoader.css";
import { DestroyAllLyricsContainers } from "../../utils/Lyrics/Applyer/CreateLyricsContainer.ts";
import ApplyLyrics, {
  cleanupApplyLyricsAbortController,
  GetAppliedLyrics,
} from "../../utils/Lyrics/Global/Applyer.ts";
import {
  addLinesEvListener,
  isRomanized,
  removeLinesEvListener,
  setRomanizedStatus,
} from "../../utils/Lyrics/lyrics.ts";
import {
  CleanupScrollEvents,
  InitializeScrollEvents,
  ResetLastLine,
} from "../../utils/Scrolling/ScrollToActiveLine.ts";
import {
  ClearScrollSimplebar,
  ScrollSimplebar,
} from "../../utils/Scrolling/Simplebar/ScrollSimplebar.ts";
import ApplyDynamicBackground, { KawarpMap, PAGE_BACKGROUND_KEY } from "../DynamicBG/dynamicBackground.ts";
import { DisposeAMLLBackground } from "../DynamicBG/AMLLBackground.ts";
import { DisposeAmllLyrics, IsAmllLyricsShowing } from "../../utils/Lyrics/Applyer/AMLL.ts";
import {
  $creditsFollowLastLine,
  $currentLyricsData,
  $duetLinePadding,
  $translationsBelow,
  $lineHoverBackground,
  $lyricsContainerExists,
  $lyricsRenderer,
  $lyricsSize,
  $minimalLyricsMode,
  $romanizationDisplay,
  $showVolumeSlider,
  $rendererVisualStyle,
  $singleLineMode,
  $lyricsFont,
  $coverOnlyMode,
  $syllableMerge,
  $syllablePace,
  $ttmlMakerMode,
  $viewControlsPosition,
} from "../../utils/stores.ts";
import Global from "../Global/Global.ts";
import Session from "../Global/Session.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { Icons, KnockoutDisc } from "../Styling/Icons.ts";
import {
  DisableCompactMode,
  EnableCompactMode,
  IsCompactMode,
} from "../Utils/CompactMode.ts";
import Fullscreen, {
  EnterSpicyLyricsFullscreen,
  ExitFullscreenElement,
  IsFullscreenClosing,
} from "../Utils/Fullscreen.ts";
import {
  NowBarObj,
  NowBar_SwapSides,
  Session_NowBar_SetSide,
  Session_OpenNowBar,
  ToggleNowBar,
  OpenNowBar,
} from "../Utils/NowBar.ts";
import TransferElement from "../Utils/TransferElement.ts";
import { SeatRomanizationToggle, SyncViewSwitch } from "../Utils/QueueView.ts";
import { IsPIP, _IsPIP_after, ClosePopupLyrics } from "../Utils/PopupLyrics.ts";
import { NPVCardOwnsPage, DeRenderNPVCard } from "../Utils/NPVLyrics.ts";
import { CleanUpIsByCommunity } from "../../utils/Lyrics/Applyer/Credits/ApplyIsByCommunity.tsx";
import { OpenLyricsDBPanel } from "../../utils/openLyricsDBPanel.tsx";
import { IsTemporaryLyricsShowing, PickTemporaryTTML } from "../../utils/Lyrics/manager/temporaryTTML.ts";
import { openSettingsPanel } from "../../utils/settings.ts";
import { ToggleCoverOnly } from "../../utils/Ruytha/PageOptions.ts";
import { DockIcons } from "../Styling/DockIcons.ts";
import { RemoveCurrentLyrics_AllCaches } from "../../utils/LyricsCacheTools.ts";
import Logger from "../../utils/Logger.ts";
import { setStockPlaybarPage } from "../../utils/themeMatcher.ts";
import { CreateTextScroller, type TextScroller } from "../../utils/TextScroller.ts";
import {
  ApplyExperimentClasses,
  isExperimentEnabled,
  onExperimentChange,
  onExperimentDefinitionChange,
} from "../../utils/experiments.ts";
import {
  lyricsSizeChanged,
  romanizedRowsToggled,
  triggerRemeasureLV,
} from "../../utils/Lyrics/LyricsVirtualizer.ts";

const pageLogger = new Logger("Page View");
const controlsLogger = new Logger("View Controls");

interface TippyInstance {
  destroy: () => void;
  [key: string]: any;
}

export const Tooltips: {
  Close: TippyInstance | null;
  CompactModeToggle: TippyInstance | null;
  RomanizationToggle: TippyInstance | null;
  TranslationToggle: TippyInstance | null;
  NowBarToggle: TippyInstance | null;
  FullscreenToggle: TippyInstance | null;
  CinemaView: TippyInstance | null;
  NowBarSideToggle: TippyInstance | null;
  LyricsManager: TippyInstance | null;
  LoadTTML: TippyInstance | null;
  ClearCurrentCache: TippyInstance | null;
  CoverOnlyToggle: TippyInstance | null;
  Settings: TippyInstance | null;
} = {
  Close: null,
  CompactModeToggle: null,
  RomanizationToggle: null,
  TranslationToggle: null,
  NowBarToggle: null,
  FullscreenToggle: null,
  CinemaView: null,
  NowBarSideToggle: null,
  LyricsManager: null,
  LoadTTML: null,
  ClearCurrentCache: null,
  CoverOnlyToggle: null,
  Settings: null,
};

const PageView = {
  Open: OpenPage,
  Destroy: DestroyPage,
  AppendViewControls,
  IsOpened: false,
  IsTippyCapable: true,
};

export const GetPageRoot = () =>
  /* document.querySelector<HTMLElement>(".QdB2YtfEq0ks5O4QbtwX .WRGTOibB8qNEkgPNtMxq") ?? */
  document.querySelector<HTMLElement>(
    ":is(.Root__main-view, :where(#main-view)) .main-view-container div[data-overlayscrollbars-viewport]"
  ) ??
  (() => {
    const child = document.querySelector<HTMLElement>(
      ":is(.Root__main-view, :where(#main-view)) .main-view-container .main-view-container__scroll-node-child"
    );
    return child?.parentElement as HTMLElement | null;
  })() ??
  document.querySelector<HTMLElement>(
    ":is(.Root__main-view, :where(#main-view)) .main-view-container .os-host"
  ) ??
  document.querySelector<HTMLElement>(
    ":is(.Root__main-view, :where(#main-view)) .main-view-container .uGZUPBPcDpzSYqKcQT8r > div"
  );

let PageMountObserver: MutationObserver | null = null;

function cancelPendingPageMount() {
  PageMountObserver?.disconnect();
  PageMountObserver = null;
}

let PageResizeListener: ResizeObserver | null = null;
// Scrolls the title and artists when they are wider than the player.
let MetadataScroller: TextScroller | null = null;
export let PageContainer: HTMLElement | null = null;
export let IsCardMode = false;

async function OpenPage(
  AppendTo: HTMLElement | undefined = undefined,
  options?: { cardMode?: boolean }
) {

  if (_IsPIP_after) {
    await ClosePopupLyrics();
    // After closing, open again with the same arguments
    return OpenPage(AppendTo, options);
  }

  if (!options?.cardMode && NPVCardOwnsPage()) {
    // The NPV card holds the global page; hand it over to the real requester.
    await DeRenderNPVCard();
    return OpenPage(AppendTo, options);
  }

  cancelPendingPageMount();
  if (PageView.IsOpened) return;

  // The main-view page belongs to the /SpicyLyrics route. The awaits above can
  // outlast a quick navigate-away; opening now would strand the page on
  // whatever route the user moved to, with nothing left to destroy it.
  if (
    AppendTo === undefined &&
    !options?.cardMode &&
    Spicetify.Platform?.History?.location?.pathname !== "/SpicyLyrics"
  ) {
    return;
  }

  const pageRoot = AppendTo ?? GetPageRoot();
  if (!pageRoot) {
    pageLogger.warn("Cannot open page: main view is unavailable");
    if (AppendTo === undefined && !options?.cardMode) {
      PageMountObserver = new MutationObserver(() => {
        if (Spicetify.Platform.History.location.pathname !== "/SpicyLyrics") {
          cancelPendingPageMount();
          return;
        }
        if (!GetPageRoot()) return;
        cancelPendingPageMount();
        void OpenPage();
      });
      PageMountObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    return;
  }

  IsCardMode = !!options?.cardMode;
  /* if (!HoverMode) {
        PageView.IsTippyCapable = false;
    } */
  const elem = document.createElement("div");
  elem.id = "SpicyLyricsPage";
  // Spotify's OverlayScrollbars (main view, NPV panel) ignores mutations inside
  // this marker. Without it, every per-frame word style write made it re-measure
  // its viewport, forcing an extra style + layout pass mid-frame. The page's size
  // never depends on its content, so there is nothing for it to pick up.
  elem.setAttribute("data-scroll-size-contained", "");

  elem.classList.add("SpicyRenderer");

  if (IsCardMode) {
    elem.classList.add("CardMode");
  }

  /* if (HoverMode) {
        elem.classList.add("TippyMode");
    } */
  //const extractedColors = ((await Spicetify.colorExtractor(SpotifyPlayer.GetUri() ?? "spotify:track:31CsSZ9KlQmEu0JvWSkM3j")) as any) ?? { VIBRANT_NON_ALARMING: "#999999" };
  //const vibrantNonAlarmingColor = extractedColors?.VIBRANT_NON_ALARMING ?? "#999999";
  elem.innerHTML = `
        <div class="ContentBox">
            <div class="NowBar">
                <div class="CenteredView">
                    <div class="Header">
                        <div class="MediaBox">
                            <div class="MediaContent"></div>
                            <div class="MediaImageContainer">
                              <div class="fi_FromImage ib_ImageBox"></div>
                              <div class="ti_ToImage ib_ImageBox"></div>
                            </div>
                        </div>
                        <div class="Metadata">
                            <div class="SongName">
                                <span></span>
                            </div>
                            <div class="Artists">
                                <span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="LyricsContainer">
                <div class="loaderContainer">
                    <div id="DotLoader"></div>
                </div>
                ${SkeletonMarkup}
                <div class="LyricsContent ScrollbarScrollable"></div>
            </div>
            <div class="ViewControls"></div>
        </div>
    `;

  if ($viewControlsPosition.get() === "Top") {
    elem.classList.add("ViewControlsPosition_Top")
  } else if ($viewControlsPosition.get() === "Bottom") {
    elem.classList.add("ViewControlsPosition_Bottom")
  }

  /* 
        <div class="SongMoreInfo">
            <div class="Content">
                <div class="SongMetadata">
                    <img src="" class="SongArtwork">
                    <div class="SongMetadataTextContent">
                        <p class="SongName">
                            <span></span>
                        </p>
                        <p class="ArtistsNames">
                            <span></span>
                        </p>
                    </div>
                </div>
                <div class="SongAnnotation">
                    <div class="BackgroundVisualizer">    
                        <p class="Annotation">
                            <span></span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    */

  
  PageContainer = elem;

  elem.style.setProperty("--SL-LyricsScale", String($lyricsSize.get() / 100));

  // UseSpicyFont and the other fonts are set by utils/Ruytha/PageOptions.ts.
  if ($lyricsFont.get() === "spicy") {
    elem.classList.add("UseSpicyFont");
  }

  if ($rendererVisualStyle.get() === "bloom") {
    elem.classList.add("BloomRenderer");
  }

  if ($minimalLyricsMode.get()) {
    elem.classList.add("MinimalLyricsMode");
  }

  if ($singleLineMode.get()) {
    elem.classList.add("SingleLineMode");
  }

  if (!$lineHoverBackground.get()) {
    elem.classList.add("NoLineHoverBackground");
  }

  if ($duetLinePadding.get()) {
    elem.classList.add("DuetLinePadding");
  }

  // Opens the romanization rows under each line (Mixed.css).
  if (isRomanized) {
    elem.classList.add("RomanizedRowsShown");
  }

  if ($creditsFollowLastLine.get()) {
    elem.classList.add("CreditsFollowLastLine");
  }

  // Gates the raised .PlaybackControls / tightened .Heart offsets that make room for
  // the volume band — without it, turning the setting off would leave a gap.
  if ($showVolumeSlider.get()) {
    elem.classList.add("ShowVolumeSlider");
  }

  ApplyExperimentClasses(elem);

  const contentBox = elem.querySelector<HTMLElement>(
    ".ContentBox"
  );
  // Card mode stays transparent — the NPV's own dynamic background shows through.
  if (contentBox && !IsCardMode) {
    try {
      ApplyDynamicBackground(contentBox, PAGE_BACKGROUND_KEY);
    } catch (err) {
      pageLogger.error("Error applying dynamic background", err);
    }
  }

  pageRoot.appendChild(elem);

  // After the append, so a page opened in the popup observes with the popup's window.
  // TextSliding / TextSettling drive the start-edge fade in Player Below the Cover (PlayerBelowCover.css).
  MetadataScroller = CreateTextScroller(
    [...elem.querySelectorAll<HTMLElement>(".NowBar .Header .Metadata :is(.SongName, .Artists)")],
    { slidingClass: "TextSliding", settlingClass: "TextSettling" }
  );

  addLinesEvListener();

  {
    const currentUri = Spicetify?.Player?.data?.item?.uri;
    if (currentUri) {
      // If a 503 retry loop is already running for this track, re-show the
      // queue loader right away so reopening the page / swapping views restores
      // the queued state with no flash of empty content.
      if (LyricsQueueRetry.IsRetryingFor(currentUri)) {
        ShowQueueLoader();
      }
      fetchLyrics(currentUri).then(ApplyLyrics);
    }
  }

  if (!IsCardMode) {
    Session_OpenNowBar();

    /* const ArtworkButton = document.querySelector<HTMLElement>("#SpicyLyricsPage .ContentBox .NowBar .Header .Artwork");

      ArtworkButton.addEventListener("click", () => {
          NowBar_SwapSides();
      }) */

    Session_NowBar_SetSide();

    AppendViewControls();

    DisableCompactMode();
  } else if (IsCompactMode()) {
    // A previous PiP/fullscreen open left the module flag set; the card page
    // never enables compact mode, and a stale flag makes ScrollToActiveLine
    // pin the active line to the top instead of centering it.
    DisableCompactMode();
  }

  PageResizeListener = new ResizeObserver(() => {
    if (!Fullscreen.IsOpen || !Fullscreen.CinemaViewOpen) return;
    Compactify(elem);
  });

  PageResizeListener.observe(elem);

  if (AppendTo === undefined) {
    const legacyPage = document.querySelector<HTMLElement>(
      ":is(.Root__main-view, :where(#main-view)) .main-view-container .os-host"
    );
    if (legacyPage) {
      legacyPage.style.containerType = "inline-size";
    }
  }

  // UpdateSongMoreInfo()

  $lyricsContainerExists.set(true);
  PageView.IsOpened = true;
  setStockPlaybarPage(elem);

  if (IsPIP) {
    elem?.classList.add("ForcedCompactMode");
    OpenNowBar(true);
    EnableCompactMode();
  }

  PageContainer = elem;

  const contentType = SpotifyPlayer.GetContentType();
  if (contentType === "episode") {
    elem?.classList.add("episode-content-type");
  } else {
    elem?.classList.remove("episode-content-type");
  }

  Global.Event.evoke("page:open", { cardMode: IsCardMode });
}

/* Global.Event.listen("playback:songchange", () => {
    if (!PageView.IsOpened) return;
    UpdateSongMoreInfo();
}) */

export const isSizeReadyToBeCompacted = () =>
  window.matchMedia("(max-width: 70.812rem)").matches;

export function Compactify(Element: HTMLElement | undefined = undefined) {
  if (!Fullscreen.IsOpen) return;
  const elem = Element ?? PageContainer;
  if (!elem) return;
  if (isSizeReadyToBeCompacted()) {
    elem.classList.add("CompactifyEnabledCompactMode");
    EnableCompactMode();
  } else {
    if (!elem.classList.contains("CompactifyEnabledCompactMode")) return;
    elem.classList.remove("CompactifyEnabledCompactMode");
    if (elem.classList.contains("ForcedCompactMode")) return;
    DisableCompactMode();
  }
}

// Deliberately synchronous (async only so callers can keep awaiting it): an
// await in here let an Open, a second Destroy, or a Fullscreen close tail run
// against a half torn-down page.
async function DestroyPage() {
  cancelPendingPageMount();
  if (!PageView.IsOpened) return;
  pageLogger.debug("Destroying page");
  PageView.IsOpened = false;

  cleanupApplyLyricsAbortController();

  // Skip the exit animation — the page is going away — and cancel any animated
  // close already playing, so it can't re-insert this page afterwards.
  Fullscreen.CloseImmediately();

  KawarpMap.get(PAGE_BACKGROUND_KEY)?.dispose();
  KawarpMap.delete(PAGE_BACKGROUND_KEY);
  DisposeAMLLBackground(PAGE_BACKGROUND_KEY);
  DisposeAmllLyrics();
  ResetLastLine();
  CleanupScrollEvents();
  PageResizeListener?.disconnect(); // Disconnect the observer
  PageResizeListener = null;
  MetadataScroller?.destroy();
  MetadataScroller = null;
  $lyricsContainerExists.set(false);
  DestroyAllLyricsContainers();
  CleanUpIsByCommunity();

  const legacyPage = document.querySelector<HTMLElement>(
    ":is(.Root__main-view, :where(#main-view)) .main-view-container .os-host"
  );
  if (legacyPage) {
    legacyPage.style.containerType = "";
  }

  PageContainer?.remove();
  setStockPlaybarPage(null);
  removeLinesEvListener();
  (Object.keys(Tooltips) as (keyof typeof Tooltips)[]).forEach((key) => {
    Tooltips[key]?.destroy();
    Tooltips[key] = null;
  });
  ClearScrollSimplebar();
  IsCardMode = false;
  Global.Event.evoke("page:destroy", null);
  PageView.IsTippyCapable = true;
  PageContainer = null;
}

export let LyricsApplied = false;

Global.Event.listen("lyrics:not-apply", () => {
  CleanupScrollEvents();
  LyricsApplied = false;
  CleanUpIsByCommunity();
});

Global.Event.listen("lyrics:apply", ({ Type }: { Type: string }) => {
  CleanupScrollEvents();

  if (!Type) return;
  if (Type === "Static") {
    // Unsynced lyrics only need to know about hand scrolls, so auto-scroll can let go.
    if (ScrollSimplebar) InitializeScrollEvents(ScrollSimplebar);
    return;
  }
  if (ScrollSimplebar) {
    InitializeScrollEvents(ScrollSimplebar);
    //QueueForceScroll(); // Queue a force scroll instead of directly calling with true
    LyricsApplied = true;
  }

  setTimeout(() => triggerRemeasureLV(), 1000);
  setTimeout(() => triggerRemeasureLV(), 1500);
});

function DestroyViewControlTooltips() {
  Object.keys(Tooltips).forEach((key) => {
    const tippy = Tooltips[key as keyof typeof Tooltips];
    if (tippy?.destroy && typeof tippy.destroy === "function") {
      tippy.destroy();
      Tooltips[key as keyof typeof Tooltips] = null;
    }
  });
}

/** Closes the open controls menu and drops its document listeners; null while closed. */
let closeDockMenu: (() => void) | null = null;
/** Whether the controls were last built as the menu; null before the first build. */
let dockBuiltAsMenu: boolean | null = null;

/**
 * The controls menu (dockMenu experiment): the toggle opens the menu toward whichever
 * side of the window has more room, nudged sideways to stay inside it. Clicking a row,
 * clicking outside, Escape, or a rebuild of the controls closes it.
 */
function SetupDockMenu(controls: HTMLElement) {
  const toggle = controls.querySelector<HTMLButtonElement>("#DockMenuToggle");
  const menu = controls.querySelector<HTMLElement>(".SL_DockMenu");
  if (!toggle || !menu) return;
  const doc = controls.ownerDocument;
  const win = doc.defaultView ?? window;
  const items = () => Array.from(menu.querySelectorAll<HTMLElement>("[role^='menuitem']"));

  const close = (refocus = false) => {
    controls.removeAttribute("data-menu-open");
    toggle.setAttribute("aria-expanded", "false");
    doc.removeEventListener("pointerdown", onOutsidePointer, true);
    doc.removeEventListener("keydown", onKey, true);
    closeDockMenu = null;
    if (refocus) toggle.focus();
  };

  const onOutsidePointer = (event: PointerEvent) => {
    if (!controls.contains(event.target as Node)) close();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      // Keeps Escape from also leaving Fullscreen or the page.
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    const list = items();
    const at = list.indexOf(doc.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? list[(at + 1) % list.length]
        : event.key === "ArrowUp"
          ? list[(at - 1 + list.length) % list.length]
          : event.key === "Home"
            ? list[0]
            : event.key === "End"
              ? list[list.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const open = (viaKeyboard: boolean) => {
    closeDockMenu?.();
    const rect = toggle.getBoundingClientRect();
    controls.dataset.menuDir = rect.top + rect.height / 2 > win.innerHeight / 2 ? "up" : "down";
    controls.style.setProperty("--dock-menu-shift", "0px");
    controls.setAttribute("data-menu-open", "");
    toggle.setAttribute("aria-expanded", "true");

    // offsetWidth, not the bounding rect: the opening scale would shrink the rect.
    const width = menu.offsetWidth;
    const centre = rect.left + rect.width / 2;
    const margin = 12;
    const left = centre - width / 2;
    const shift =
      left < margin
        ? margin - left
        : left + width > win.innerWidth - margin
          ? win.innerWidth - margin - (left + width)
          : 0;
    controls.style.setProperty("--dock-menu-shift", `${Math.round(shift)}px`);

    doc.addEventListener("pointerdown", onOutsidePointer, true);
    doc.addEventListener("keydown", onKey, true);
    closeDockMenu = () => close();
    if (viaKeyboard) items()[0]?.focus();
  };

  toggle.addEventListener("click", (event) => {
    if (controls.hasAttribute("data-menu-open")) close();
    // detail is 0 for a click made with Enter or Space.
    else open(event.detail === 0);
  });

  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!controls.hasAttribute("data-menu-open")) open(true);
  });

  // A row's own handler runs first (bound in SetupTippy); this only puts the menu away.
  menu.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("[role^='menuitem']")) close();
  });
}

// Player Below the Cover stacks the view controls in a column beside the cover
// (PlayerBelowCover.css), where a tooltip above or below a button would sit on its
// neighbour. There they open sideways, toward the lyrics. Decided on each show, since
// the layout comes and goes with the experiment, compact mode and Canvas Stage.
function ViewControlTooltipProps(): Record<string, unknown> {
  const base = (Spicetify.TippyProps ?? {}) as Record<string, unknown> & {
    placement?: string;
    onShow?: (instance: any) => unknown;
  };
  return {
    ...base,
    onShow(instance: any) {
      const page = PageContainer;
      // Seated in the Lyrics / Queue switch (QueueView.ts), a toggle is in a row, not the column.
      const column =
        !!page &&
        !instance.reference?.closest?.(".ViewSwitch") &&
        page.classList.contains("Fullscreen") &&
        page.classList.contains("Exp_PlayerBelowCover") &&
        !page.classList.contains("CanvasImmersive") &&
        !page.classList.contains("CompactMode") &&
        !page.classList.contains("ForcedCompactMode");
      const placement = column
        ? page.classList.contains("NowBarSide__Right")
          ? "left"
          : "right"
        : (base.placement ?? "top");
      if (instance.props?.placement !== placement) instance.setProps({ placement });
      return base.onShow?.(instance);
    },
  };
}

// A toggle whose click swaps its own glyph gets that glyph eased in (SL_IconSwapIn, default.css).
// The controls are rebuilt whole, and one click can rebuild them more than once, so the swap is
// armed by the click and carried across rebuilds: the first starts the animation, a later one
// picks it up where it had got to instead of starting it over.
// A grouped toggle keeps its glyph, so its disc fills in or clears instead (SL_ToggleSwap).
const ICON_SWAP_MS = 200;
const TOGGLE_SWAP_MS = 320;
const ICON_SWAP_ARM_MS = 3000;
let IconSwap: { id: string; armedAt: number; startedAt: number | null } | null = null;

function ArmIconSwap(id: string) {
  IconSwap = { id, armedAt: performance.now(), startedAt: null };
}

// A grouped toggle answers the click itself: its disc starts filling or clearing at once, and the
// rebuild that follows picks the motion up where it has got to (ApplyIconSwap).
function PressToggle(button: Element) {
  if (!button.classList.contains("ViewToggle")) return;
  const now = performance.now();
  // A button rebuilt after an earlier flip still carries that replay; this flip is a transition.
  // The style has to settle without the replay first, or the flip lands in the same style change
  // and the disc snaps instead of transitioning.
  if (button.classList.contains("SL_ToggleSwap")) {
    button.classList.remove("SL_ToggleSwap");
    (button as HTMLElement).style.removeProperty("--ToggleSwapDelay");
    void getComputedStyle(button.querySelector(".SL_KnockoutDisc") ?? button).opacity;
  }
  button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
  IconSwap = { id: button.id, armedAt: now, startedAt: now };
}

function ApplyIconSwap(controls: HTMLElement) {
  if (!IconSwap) return;
  const now = performance.now();
  const button = controls.querySelector<HTMLElement>(`#${IconSwap.id}`);
  const isToggle = button?.classList.contains("ViewToggle") ?? false;
  const elapsed = IconSwap.startedAt === null ? 0 : now - IconSwap.startedAt;
  if (
    elapsed >= (isToggle ? TOGGLE_SWAP_MS : ICON_SWAP_MS) ||
    now - IconSwap.armedAt > ICON_SWAP_ARM_MS
  ) {
    IconSwap = null;
    return;
  }
  if (isToggle && button) {
    IconSwap.startedAt ??= now;
    button.classList.add("SL_ToggleSwap");
    if (elapsed > 0) button.style.setProperty("--ToggleSwapDelay", `-${Math.round(elapsed)}ms`);
    return;
  }
  const svg = button?.querySelector<SVGElement>("svg");
  if (!svg) return;
  IconSwap.startedAt ??= now;
  svg.classList.add("SL_IconSwapIn");
  if (elapsed > 0) svg.style.animationDelay = `-${Math.round(elapsed)}ms`;
}

// Which markup the controls were last built with, so a remote override that flips the grouped
// layout without touching the stored value still gets them rebuilt.
let RenderedGroupedControls: boolean | null = null;

function AppendViewControls(ReAppend: boolean = false) {
  if (IsCardMode) return;
  if (!PageContainer) return;
  controlsLogger.debug("Append view controls");
  // The Lyrics / Queue switch lives in its own corner but comes and goes with the same views.
  SyncViewSwitch();
  const elem = PageContainer.querySelector<HTMLElement>(
    ".ContentBox .ViewControls"
  );
  if (!elem) return;

  DestroyViewControlTooltips();
  // A rebuild replaces the menu's contents, so drop the open one and its listeners.
  closeDockMenu?.();

  if (ReAppend) elem.innerHTML = "";
  const isNoLyrics =
    $currentLyricsData.get() === `NO_LYRICS:${SpotifyPlayer.GetUri()}`;
  const isTTMLMakerMode = $ttmlMakerMode.get();
  // The dock (RuythaDock.css): what the page shows, then what it does with the lyrics,
  // then settings and close, each group split by a hairline. Empty groups drop out.
  // With the dockMenu experiment the same buttons become labelled rows of a menu
  // behind one button; the handlers below find them either way.
  const inFullscreen = Fullscreen.IsOpen || Fullscreen.CinemaViewOpen;
  const asMenu = isExperimentEnabled("dockMenu");
  dockBuiltAsMenu = asMenu;
  // The dock keeps its own markup, so Grouped View Controls is locked off (experiments.ts).
  const grouped = isExperimentEnabled("groupedViewControls");
  RenderedGroupedControls = grouped;
  const button =(id: string, icon: string, label: string, pressed?: boolean, extraClass = "") => {
    const className = `ViewControl${extraClass ? ` ${extraClass}` : ""}`;
    if (!asMenu) {
      return `<button id="${id}" class="${className}"${pressed === undefined ? "" : ` aria-pressed="${pressed}"`}>${icon}</button>`;
    }
    const role =
      pressed === undefined ? `role="menuitem"` : `role="menuitemcheckbox" aria-checked="${pressed}"`;
    return `<button id="${id}" class="${className}" ${role} tabindex="-1">${icon}<span class="SL_DockLabel">${label}</span>${pressed ? `<span class="SL_DockCheck">${DockIcons.Check}</span>` : ""}</button>`;
  };
  const viewGroup = [
    !inFullscreen && !IsPIP ? button("CinemaView", DockIcons.CinemaView, "Cinema View") : "",
    Fullscreen.IsOpen && !IsPIP
      ? button(
          "FullscreenToggle",
          Fullscreen.CinemaViewOpen ? DockIcons.Fullscreen : DockIcons.CloseFullscreen,
          Fullscreen.CinemaViewOpen ? "Fullscreen" : "Exit Fullscreen"
        )
      : "",
    inFullscreen && !IsPIP
      ? button(
          "CompactModeToggle",
          IsCompactMode() ? DockIcons.DisableCompactMode : DockIcons.EnableCompactMode,
          "Compact Mode",
          IsCompactMode()
        )
      : "",
    !inFullscreen && !IsPIP ? button("NowBarToggle", DockIcons.NowBar, "NowBar", NowBarObj.Open) : "",
    NowBarObj.Open && !IsPIP ? button("NowBarSideToggle", DockIcons.NowBarSideSwap, "Swap NowBar Side") : "",
    !IsPIP ? button("CoverOnlyToggle", DockIcons.CoverOnly, "Cover Only", $coverOnlyMode.get()) : "",
  ].join("");
  const lyricsGroup = [
    button("RomanizationToggle", DockIcons.Romanization, "Romanization", isRomanized),
    button("TranslationToggle", DockIcons.Translation, "Translation", $translationsBelow.get()),
    isTTMLMakerMode ? button("LoadTTML", DockIcons.LoadTTML, "Load TTML File") : "",
    isTTMLMakerMode ? button("LyricsManager", DockIcons.LyricsManager, "Lyrics Manager") : "",
    button("ClearCurrentCache", DockIcons.ClearCache, "Clear Cached Lyrics"),
  ].join("");
  const appGroup = [
    !IsPIP ? button("SettingsToggle", DockIcons.Settings, "Settings") : "",
    button("Close", DockIcons.Close, "Close Page", undefined, "SL_DockClose"),
  ].join("");
  const groups = [viewGroup, lyricsGroup, appGroup].filter(Boolean);
  elem.innerHTML = asMenu
    ? `<button id="DockMenuToggle" class="ViewControl SL_DockMenuToggle" aria-haspopup="menu" aria-expanded="false" aria-label="Controls">${DockIcons.More}</button>` +
      `<div class="SL_DockMenu" role="menu" aria-label="Lyrics page controls">${groups.join(
        `<span class="SL_DockMenuSeparator" role="separator"></span>`
      )}</div>`
    : groups.join(`<span class="SL_DockDivider" aria-hidden="true"></span>`);

  let targetElem: HTMLElement | null = elem;
  if (Fullscreen.IsOpen) {
    const mediaContent = PageContainer?.querySelector<HTMLElement>(
      ".ContentBox .NowBar .Header .MediaBox .MediaContent"
    );
    if (mediaContent) {
      TransferElement(elem, mediaContent);
      const viewControls =
        mediaContent.querySelector<HTMLElement>(".ViewControls");
      if (viewControls) {
        targetElem = viewControls;
      }
    }
  } else {
    const contentBox = PageContainer?.querySelector<HTMLElement>(".ContentBox");
    if (
      PageContainer?.querySelector<HTMLElement>(
        ".ContentBox .NowBar .Header .ViewControls"
      ) &&
      contentBox
    ) {
      TransferElement(elem, contentBox);
    }
  }

  if (targetElem) {
    SetupTippy(targetElem);
    if (asMenu) {
      // Every row carries its own label, so hover tooltips would only repeat it.
      DestroyViewControlTooltips();
      SetupDockMenu(targetElem);
    }
  }
  // Wired up, the romanization toggle moves into the Lyrics / Queue switch where there is one.
  SeatRomanizationToggle();

  function SetupTippy(elem: HTMLElement) {
    // If in PIP mode, do not create any Tippy tooltips, but still wire up click handlers
    const isPip = IsPIP;

    const closeButton = elem.querySelector("#Close");
    if (closeButton) {
      try {
        if (!isPip) {
          Tooltips.Close = createTooltip(closeButton, {
            ...ViewControlTooltipProps(),
            content: `Close Page`,
          });
        }
        closeButton.addEventListener("click", async () => {
          if (IsPIP) {
            await ClosePopupLyrics();
            globalThis.focus();
            return;
          }

          // A superseded close (the user navigated, or reopened the page,
          // during the exit animation) must not navigate on top of that.
          // A second click mid-animation joins the running close.
          if (
            (Fullscreen.IsOpen || IsFullscreenClosing()) &&
            !(await Fullscreen.Close())
          ) {
            return;
          }

          Session.GoBackFrom("/SpicyLyrics");
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Close tooltip", err);
      }
    }

    const compactModeToggle = elem.querySelector("#CompactModeToggle");
    if (compactModeToggle) {
      try {
        if (!isPip) {
          Tooltips.CompactModeToggle = createTooltip(compactModeToggle, {
            ...ViewControlTooltipProps(),
            content: `${
              IsCompactMode() ? "Disable Compact Mode" : "Enable Compact Mode"
            }`,
          });
        }
        compactModeToggle.addEventListener("click", () => {
          if (grouped) PressToggle(compactModeToggle);
          else ArmIconSwap("CompactModeToggle");
          // Use PageContainer instead of document.querySelector
          const SpicyLyricsPage = PageContainer;
          if (Fullscreen.IsOpen || Fullscreen.CinemaViewOpen) {
            if (IsCompactMode()) {
              SpicyLyricsPage?.classList.remove("ForcedCompactMode");
              DisableCompactMode();
              $forceCompactMode.set(false);
            } else {
              SpicyLyricsPage?.classList.add("ForcedCompactMode");
              EnableCompactMode();
              $forceCompactMode.set(true);
            }

            setTimeout(() => {
              AppendViewControls(true);
            }, 65);
          }
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Compact Mode tooltip", err);
      }
    }

    const romanizationToggle = elem.querySelector("#RomanizationToggle");
    if (romanizationToggle) {
      try {
        if (!isPip) {
          Tooltips.RomanizationToggle = createTooltip(romanizationToggle, {
            ...ViewControlTooltipProps(),
            content: isRomanized ? `Disable Romanization` : `Enable Romanization`,
          });
        }
        romanizationToggle.addEventListener("click", async () => {
          const songUri = SpotifyPlayer.GetUri();
          if (!songUri) return;
          if (grouped) PressToggle(romanizationToggle);
          else ArmIconSwap("RomanizationToggle");
          // Under each line, the rows are already built: they open or close in
          // place. A fetch in flight builds them too, and the class decides. The AMLL
          // renderer builds its rows only with romanization on, so it renders again.
          if ($romanizationDisplay.get() === "underLine" && !IsAmllLyricsShowing()) {
            romanizedRowsToggled(() => setRomanizedStatus(!isRomanized));
            AppendViewControls();
            return;
          }
          PageContainer?.querySelector(
            ".LyricsContainer .LyricsContent"
          )?.classList.add("HiddenTransitioned");
          // Flip first: if a fetch for this track is already in flight,
          // fetchLyrics returns null and that fetch's own apply renders —
          // it reads the flag at apply time, so it picks this change up.
          setRomanizedStatus(!isRomanized);

          const lyrics = await fetchLyrics(songUri);
          if (lyrics) await ApplyLyrics(lyrics);

          setTimeout(() => {
            AppendViewControls();
            PageContainer?.querySelector(
              ".LyricsContainer .LyricsContent"
            )?.classList.remove("HiddenTransitioned");
          }, 45);
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Romanization tooltip", err);
      }
    }

    const translationToggle = elem.querySelector("#TranslationToggle");
    if (translationToggle) {
      if (!isPip) {
        Tooltips.TranslationToggle = createTooltip(translationToggle, {
          ...Spicetify.TippyProps,
          content: $translationsBelow.get() ? "Hide Translation" : "Show Translation",
        });
      }
      // The store's listener redraws the lyrics; the controls are redrawn for the button's state.
      translationToggle.addEventListener("click", () => {
        $translationsBelow.set(!$translationsBelow.get());
        setTimeout(AppendViewControls, 45);
      });
    }

    if (!Fullscreen.IsOpen && !Fullscreen.CinemaViewOpen) {
      const nowBarButton = elem.querySelector("#NowBarToggle");
      if (nowBarButton) {
        try {
          if (!isPip) {
            Tooltips.NowBarToggle = createTooltip(nowBarButton, {
              ...ViewControlTooltipProps(),
              content: `NowBar`,
            });
          }
          nowBarButton.addEventListener("click", () => {
            if (grouped) PressToggle(nowBarButton);
            ToggleNowBar();
          });
        } catch (err) {
          controlsLogger.warn("Failed to setup NowBar tooltip", err);
        }
      }

    }

    const fullscreenBtn = elem.querySelector("#FullscreenToggle");
    if (fullscreenBtn) {
      try {
        if (!isPip) {
          Tooltips.FullscreenToggle = createTooltip(fullscreenBtn, {
            ...ViewControlTooltipProps(),
            content: `${
              Fullscreen.CinemaViewOpen ? "Fullscreen" : "Cinema View"
            }`,
          });
        }
        fullscreenBtn.addEventListener("click", async () => {
          if (grouped) PressToggle(fullscreenBtn);
          // If we're in cinema view, go to full fullscreen
          if (Fullscreen.CinemaViewOpen) {
            Fullscreen.CinemaViewOpen = false;
            await EnterSpicyLyricsFullscreen();
            PageView.AppendViewControls(true);
          } else {
            Fullscreen.CinemaViewOpen = true;
            await ExitFullscreenElement();
            PageView.AppendViewControls(true);
          }
          setTimeout(Compactify, 250);
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Fullscreen tooltip", err);
      }
    }

    const cinemaViewBtn = elem.querySelector("#CinemaView");
    if (cinemaViewBtn && !Fullscreen.IsOpen) {
      try {
        if (!isPip) {
          Tooltips.CinemaView = createTooltip(cinemaViewBtn, {
            ...ViewControlTooltipProps(),
            content: `Cinema View`,
          });
        }
        cinemaViewBtn.addEventListener("click", async () => {
          Fullscreen.Open(true);
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Cinema View tooltip", err);
      }
    }

    const nowBarSideToggleBtn = elem.querySelector("#NowBarSideToggle");
    if (
      nowBarSideToggleBtn &&
      NowBarObj.Open &&
      !(isNoLyrics && (Fullscreen.IsOpen || Fullscreen.CinemaViewOpen))
    ) {
      try {
        if (!isPip) {
          Tooltips.NowBarSideToggle = createTooltip(nowBarSideToggleBtn, {
            ...ViewControlTooltipProps(),
            content: `Swap NowBar Side`,
          });
        }
        nowBarSideToggleBtn.addEventListener("click", () => NowBar_SwapSides());
      } catch (err) {
        controlsLogger.warn("Failed to setup NowBar Side Toggle tooltip", err);
      }
    }

    const clearCacheButton = elem.querySelector("#ClearCurrentCache");
    if (clearCacheButton) {
      try {
        if (!isPip) {
          Tooltips.ClearCurrentCache = createTooltip(clearCacheButton, {
            ...Spicetify.TippyProps,
            content: `Clear This Song's Cached Lyrics`,
          });
        }
        // Drops this song from every lyrics cache and fetches its lyrics again.
        clearCacheButton.addEventListener("click", () => RemoveCurrentLyrics_AllCaches(true));
      } catch (err) {
        controlsLogger.warn("Failed to setup Clear Cache button", err);
      }
    }

    const coverOnlyButton = elem.querySelector("#CoverOnlyToggle");
    if (coverOnlyButton && !isPip) {
      try {
        Tooltips.CoverOnlyToggle = createTooltip(coverOnlyButton, {
          ...Spicetify.TippyProps,
          content: $coverOnlyMode.get() ? "Show the Lyrics (C)" : "Cover Only (C)",
        });
        coverOnlyButton.addEventListener("click", () => ToggleCoverOnly());
      } catch (err) {
        controlsLogger.warn("Failed to setup Cover Only button", err);
      }
    }

    const settingsButton = elem.querySelector("#SettingsToggle");
    if (settingsButton && !isPip) {
      try {
        Tooltips.Settings = createTooltip(settingsButton, {
          ...ViewControlTooltipProps(),
          content: `Spicy Lyrics Settings`,
        });
        settingsButton.addEventListener("click", () => {
          openSettingsPanel();
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Settings tooltip", err);
      }
    }

    const loadTTMLButton = elem.querySelector("#LoadTTML");
    if (loadTTMLButton && isTTMLMakerMode) {
      try {
        if (!isPip) {
          Tooltips.LoadTTML = createTooltip(loadTTMLButton, {
            ...Spicetify.TippyProps,
            content: `Load a TTML File for This Song`,
          });
        }
        // The picker opens in the button's own window: Popup Lyrics has its own document.
        loadTTMLButton.addEventListener("click", () => PickTemporaryTTML(loadTTMLButton.ownerDocument));
      } catch (err) {
        controlsLogger.warn("Failed to setup Load TTML button", err);
      }
    }

    const lyricsManagerButton = elem.querySelector("#LyricsManager");
    if (lyricsManagerButton && isTTMLMakerMode) {
      try {
        if (!isPip) {
          Tooltips.LyricsManager = createTooltip(lyricsManagerButton, {
            ...ViewControlTooltipProps(),
            content: `Lyrics Manager`,
          });
        }
        lyricsManagerButton.addEventListener("click", () => {
          if (IsPIP) {
            globalThis.focus();
          }
          
          OpenLyricsDBPanel();
        });
      } catch (err) {
        controlsLogger.warn("Failed to setup Lyrics Manager tooltip", err);
      }
    }
  }
}

// --- Reactive setting subscriptions ---

// Rebuilds the lyrics after a setting that shapes them changes. A "Just once" upload
// rebuilds from what's held: refetching would swap it for the song's normal lyrics.
function rebuildLyrics() {
  const uri = SpotifyPlayer.GetUri();
  if (!HoldsTemporaryUpload(uri)) $currentLyricsData.set("");
  if (uri) fetchLyrics(uri).then(ApplyLyrics);
}

// The letter split, word springs and line timing are fixed when the lyrics are
// built, so a style change rebuilds them.
$rendererVisualStyle.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("BloomRenderer", v === "bloom");
  rebuildLyrics();
});

$minimalLyricsMode.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("MinimalLyricsMode", v);
  rebuildLyrics();
});

// Pure CSS (Mixed.css), so the lyrics don't need rebuilding.
$singleLineMode.listen((v) => {
  PageContainer?.classList.toggle("SingleLineMode", v);
});

$syllableMerge.listen(rebuildLyrics);
$syllablePace.listen(rebuildLyrics);
// Rows under each line are built with romanization off too, so the toggle can
// open them in place; switching to or from them always renders again.
$romanizationDisplay.listen(rebuildLyrics);

// Synchronous, so romanizedRowsToggled sees the rows change inside its flip.
$romanization.listen((v) => {
  PageContainer?.classList.toggle("RomanizedRowsShown", v);
});

// CSS sizes the text. The list's cached row heights and scroll position are JS, so those follow.
$lyricsSize.listen((v, previous) => {
  if (!PageContainer) return;
  PageContainer.style.setProperty("--SL-LyricsScale", String(v / 100));
  lyricsSizeChanged(v / previous);
  ResetLastLine();
});


$translationsBelow.listen(() => {
  const uri = SpotifyPlayer.GetUri();
  $currentLyricsData.set("");
  if (uri) fetchLyrics(uri).then(ApplyLyrics);
});

$lyricsRenderer.listen(() => {
  const uri = SpotifyPlayer.GetUri();
  // A temporary TTML exists only on screen, so a fresh fetch would lose it: draw the
  // same lyrics again with the new renderer instead.
  const shown = GetAppliedLyrics();
  if (uri && shown && IsTemporaryLyricsShowing(uri)) {
    void ApplyLyrics([shown, 200, uri]);
    return;
  }
  $currentLyricsData.set("");
  if (uri) fetchLyrics(uri).then(ApplyLyrics);
});

// Purely a CSS toggle — no need to re-render the lyrics like the modes above do.
$lineHoverBackground.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("NoLineHoverBackground", !v);
});

$duetLinePadding.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("DuetLinePadding", v);
});

$creditsFollowLastLine.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("CreditsFollowLastLine", v);
});

// Purely a CSS gate — NowBar.ts handles rebuilding the band itself.
$showVolumeSlider.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("ShowVolumeSlider", v);
});

// Experiments own their CSS hook here; NowBar.ts handles the rebuild for the ones
// that need one. Adding an experiment requires no change to this file.
onExperimentChange((experiment) => {
  if (!PageContainer) return;
  ApplyExperimentClasses(PageContainer);
  // The controls are built as a dock or as a menu, so build them again.
  if (experiment.id === "dockMenu") AppendViewControls(true);
  if (experiment.id === "groupedViewControls") AppendViewControls(true);
  // Romaji is made when the lyrics are fetched, so rebuild them.
  if (experiment.id === "romajiAsWritten") {
    rebuildLyrics();
  }
});
onExperimentDefinitionChange(() => {
  if (!PageContainer) return;
  ApplyExperimentClasses(PageContainer);
  // A remote default or forceState can flip the menu, or the grouped layout, without a
  // stored value changing.
  if (
    (dockBuiltAsMenu !== null && isExperimentEnabled("dockMenu") !== dockBuiltAsMenu) ||
    (RenderedGroupedControls !== null &&
      RenderedGroupedControls !== isExperimentEnabled("groupedViewControls"))
  ) {
    AppendViewControls(true);
  }
});

$viewControlsPosition.listen((v) => {
  if (!PageContainer) return;
  PageContainer.classList.toggle("ViewControlsPosition_Top", v === "Top");
  PageContainer.classList.toggle("ViewControlsPosition_Bottom", v === "Bottom");
  AppendViewControls(true);
});

// The button's state and tooltip change with it.
$coverOnlyMode.listen(() => {
  if (!PageContainer) return;
  setTimeout(() => AppendViewControls(true), 0);
});

$ttmlMakerMode.listen((v) => {
  if (!PageContainer) return;
  AppendViewControls(true);
})

export default PageView;

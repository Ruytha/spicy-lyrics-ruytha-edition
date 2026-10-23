import { useStore } from "@nanostores/react";
import React, { useEffect, useState } from "react";
import Session from "../../Global/Session.ts";
import App from "../../../utils/app.ts";
import { $spicyLyricsVersion } from "../../../utils/stores.ts";
import { OpenBugReport } from "../../../utils/Ruytha/BugReport.ts";
import { CHANGELOG_URL, FORK_URL, GetForkRelease, MAKER } from "../../../utils/Ruytha/ForkRelease.ts";

interface Link {
  label: string;
  url: string;
  /** Platform tint, as an "r, g, b" triplet. Omitted for the neutral treatment. */
  brand?: string;
}

// Ruytha's own links (from ruytha.dev): the fork's questions go there, not to Spicy Lyrics.
const LINKS: Link[] = [
  { label: "Website", url: MAKER.site },
  { label: "Discord", url: MAKER.discord, brand: "88, 101, 242" },
  { label: "Ko-fi", url: MAKER.kofi, brand: "255, 94, 138" },
];

/** "checking" until the fetch lands; "unknown" if it never does. */
export type UpdateStatus = "checking" | "latest" | "outdated" | "unknown";

interface Version {
  Major: number;
  Minor: number;
  Patch: number;
}

/** Ordered compare — Minor only decides once Major ties, and Patch once both do. */
function isNewer(a: Version, b: Version): boolean {
  if (a.Major !== b.Major) return a.Major > b.Major;
  if (a.Minor !== b.Minor) return a.Minor > b.Minor;
  return a.Patch > b.Patch;
}

/** Checks once per mount. The panel owns it, so the sidebar can flag an update too. */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const latest = await Session.SpicyLyrics.GetLatestVersion();
        const current = Session.SpicyLyrics.GetCurrentVersion();
        if (cancelled) return;
        // Either side missing means the check didn't conclude — saying
        // "Latest" there would be a guess dressed up as a fact.
        if (!latest || !current) {
          setStatus("unknown");
          return;
        }
        setStatus(isNewer(latest, current) ? "outdated" : "latest");
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

function ExternalArrow() {
  return (
    <svg
      className="sl-sp-about-arrow"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.5L7.5 2.5M7.5 2.5H3.5M7.5 2.5V6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The fork's own row: its bugs go to its GitHub, not to Spicy Lyrics' Discord. */
const FORK_LINKS = [
  { label: "Report a bug", onClick: OpenBugReport },
  { label: "Changelog", onClick: () => window.open(CHANGELOG_URL, "_blank") },
  { label: "Ruytha Edition on GitHub", onClick: () => window.open(FORK_URL, "_blank") },
];

export default function About({ status }: { status: UpdateStatus }) {
  const version = useStore($spicyLyricsVersion);
  const build = App.isDev() ? "dev" : "public";
  const forkRelease = GetForkRelease();

  return (
    <div className="sl-sp-about">
      <div className="sl-sp-maker">
        <img className="sl-sp-maker-avatar" src={MAKER.avatar} alt="" width={64} height={64} />
        <div className="sl-sp-maker-text">
          <span className="sl-sp-maker-kicker">Ruytha Edition is made by</span>
          <span className="sl-sp-maker-name">{MAKER.name}</span>
          <span className="sl-sp-maker-line">
            Builds this fork and syncs lyrics for it. Built on Spicy Lyrics by Spikerko.
          </span>
        </div>
        <div className="sl-sp-maker-links">
          <button type="button" className="sl-sp-about-link" onClick={() => window.open(MAKER.github, "_blank")}>
            <span>GitHub</span>
            <ExternalArrow />
          </button>
        </div>
      </div>

      <div className="sl-sp-about-hero">
        <span className="sl-sp-about-wordmark">Spicy Lyrics</span>
        <div className="sl-sp-about-status-row">
          <span className="sl-sp-about-version">Version {version}</span>
          {(status === "latest" || status === "outdated") && (
            <>
              <span className="sl-sp-about-sep" aria-hidden="true">
                ·
              </span>
              <span className={`sl-sp-about-status sl-sp-about-status--${status}`}>
                {status === "latest" ? "Up to date" : "Update available"}
              </span>
            </>
          )}
          {status === "outdated" && (
            <button
              type="button"
              className="sl-sp-about-update"
              onClick={() => Session.Navigate({ pathname: "/SpicyLyrics/Update" })}
            >
              Update
            </button>
          )}
        </div>
        <span className="sl-sp-about-build">
          Build <span className="sl-sp-about-build-value">{build}</span>
        </span>
        {forkRelease && (
          <span className="sl-sp-about-build">
            Ruytha Edition <span className="sl-sp-about-build-value">{forkRelease.name}</span>
          </span>
        )}
      </div>

      <div className="sl-sp-about-links">
        {FORK_LINKS.map(({ label, onClick }) => (
          <button key={label} type="button" className="sl-sp-about-link" onClick={onClick}>
            <span>{label}</span>
            <ExternalArrow />
          </button>
        ))}
      </div>

      <div className="sl-sp-about-links">
        {LINKS.map(({ label, url, brand }) => (
          <button
            key={label}
            type="button"
            className={`sl-sp-about-link${brand ? " sl-sp-about-link--brand" : ""}`}
            style={brand ? ({ "--brand": brand } as React.CSSProperties) : undefined}
            onClick={() => window.open(url, "_blank")}
          >
            <span>{label}</span>
            <ExternalArrow />
          </button>
        ))}
      </div>
    </div>
  );
}

import { ProjectName } from "../../project/config";
import { Maid } from "../modules/Maid";
import { $developerMode } from "./stores";

// The latest warnings and errors from every logger, newest last, for the copied debug info.
const RECENT_PROBLEMS_MAX = 40;
const recentProblems: string[] = [];

function describeArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;
  try {
    const json = JSON.stringify(arg);
    return json === undefined ? String(arg) : json.length > 300 ? `${json.slice(0, 300)}…` : json;
  } catch {
    return String(arg);
  }
}

function rememberProblem(level: "warn" | "error", prefix: string, args: unknown[]) {
  const time = new Date().toISOString().slice(11, 19);
  recentProblems.push(`${time} ${level} ${prefix} ${args.map(describeArg).join(" ")}`);
  if (recentProblems.length > RECENT_PROBLEMS_MAX) recentProblems.shift();
}

/** The latest warnings and errors logged this session, oldest first. */
export function GetRecentLogProblems(): readonly string[] {
  return recentProblems;
}

class Logger {
  private maid: Maid;

  public isEnabled = false;
  public prefix: string;

  constructor(prefix?: string) {
    this.maid = new Maid();
    this.prefix = `[${ProjectName}]${prefix ? ` (${prefix})` : ""}`;
    this.isEnabled = $developerMode.get();

    this.maid.Give(
      $developerMode.subscribe((v) => {
        this.isEnabled = v;
      })
    )
  }

  private getPrefixArgs(): [string, string] {
    return [`%c${this.prefix}`, "color: #c9c9c9;"];
  }

  info(...args: unknown[]) {
    if (this.maid.IsDestroyed() || !this.isEnabled) return;
    const [prefix, style] = this.getPrefixArgs();
    console.info(prefix, style, ...args);
  }

  warn(...args: unknown[]) {
    // Warnings always reach the console — they surface real runtime issues
    // that users (and bug reports) need to see regardless of developer mode.
    if (this.maid.IsDestroyed()) return;
    rememberProblem("warn", this.prefix, args);
    const [prefix, style] = this.getPrefixArgs();
    console.warn(prefix, style, ...args);
  }

  error(...args: unknown[]) {
    // Errors always reach the console, regardless of developer mode.
    if (this.maid.IsDestroyed()) return;
    rememberProblem("error", this.prefix, args);
    const [prefix, style] = this.getPrefixArgs();
    console.error(prefix, style, ...args);
  }

  debug(...args: unknown[]) {
    if (this.maid.IsDestroyed() || !this.isEnabled) return;
    const [prefix, style] = this.getPrefixArgs();
    console.debug(prefix, style, ...args);
  }

  destroy() {
    if (this.maid.IsDestroyed()) return;
    this.maid.Destroy();
  }
}

export default Logger;
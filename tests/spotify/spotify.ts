// Drives a running Spotify for trying changes, over Chrome's debugging protocol.
// Spotify has to be started with --remote-debugging-port=8088 (see README.md).
//
//   bun tests/spotify/spotify.ts install          use dist/spicy-lyrics.js instead of the release
//   bun tests/spotify/spotify.ts restore          go back to the release loader
//   bun tests/spotify/spotify.ts reload           reload Spotify's page (picks up an install)
//   bun tests/spotify/spotify.ts play <search>    play the first song the search finds
//   bun tests/spotify/spotify.ts seek <seconds>   jump to a point in the song
//   bun tests/spotify/spotify.ts lyrics           open the lyrics page
//   bun tests/spotify/spotify.ts ttml <file>      show a TTML on the playing song, until it plays again
//   bun tests/spotify/spotify.ts eval <js>        run JavaScript in Spotify and print the result
//   bun tests/spotify/spotify.ts shot <out.png>   screenshot Spotify (it has to be on screen)
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = 8088;
const EXTENSIONS = join(process.env.APPDATA ?? "", "Spotify", "Apps", "xpui", "extensions");
const LOADER = join(EXTENSIONS, "spicy-lyrics-ruytha.mjs");
const LOADER_BACKUP = join(EXTENSIONS, "spicy-lyrics-ruytha.mjs.release");
const TEST_BUILD = join(EXTENSIONS, "spicy-lyrics-ruytha-test.js");

type Reply = { result?: { result?: { value?: unknown }; exceptionDetails?: unknown; data?: string } };

/** Sends one command to Spotify's page and returns its reply. */
async function send(method: string, params: Record<string, unknown>): Promise<Reply> {
  let targets: { type: string; url: string; webSocketDebuggerUrl: string }[];
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  } catch {
    throw new Error(`Spotify isn't listening on port ${PORT}: start it with --remote-debugging-port=${PORT}`);
  }
  const page = targets.find((t) => t.type === "page" && t.url.includes("xpui")) ?? targets.find((t) => t.type === "page");
  if (!page) throw new Error("No Spotify page to talk to");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return new Promise((resolve) => {
    ws.onmessage = (message) => {
      const reply = JSON.parse(String(message.data)) as Reply & { id?: number };
      if (reply.id !== 1) return;
      ws.close();
      resolve(reply);
    };
    ws.send(JSON.stringify({ id: 1, method, params }));
  });
}

async function evaluate(expression: string): Promise<unknown> {
  const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails, null, 2));
  return reply.result?.result?.value;
}

const [command, ...args] = process.argv.slice(2);
const arg = args.join(" ");

switch (command) {
  case "install": {
    if (!existsSync(LOADER_BACKUP)) copyFileSync(LOADER, LOADER_BACKUP);
    copyFileSync(join(import.meta.dir, "..", "..", "dist", "spicy-lyrics.js"), TEST_BUILD);
    writeFileSync(LOADER, 'import("./spicy-lyrics-ruytha-test.js");\n');
    console.log("Installed dist/spicy-lyrics.js. Reload Spotify to use it; `restore` when done.");
    break;
  }
  case "restore": {
    if (!existsSync(LOADER_BACKUP)) throw new Error("Nothing to restore: the release loader is in place");
    copyFileSync(LOADER_BACKUP, LOADER);
    rmSync(LOADER_BACKUP);
    rmSync(TEST_BUILD, { force: true });
    console.log("Back on the release loader. Reload Spotify to use it.");
    break;
  }
  case "reload":
    await evaluate("setTimeout(() => location.reload(), 100)");
    break;
  case "play":
    console.log(
      await evaluate(`(async () => {
        const r = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.searchSuggestions, {
          query: ${JSON.stringify(arg)}, limit: 10, numberOfTopResults: 10, offset: 0, includeAuthors: false,
        });
        const track = (r?.data?.searchV2?.topResultsV2?.itemsV2 ?? []).map((i) => i.item?.data).find((d) => d?.__typename === "Track");
        if (!track) return "Nothing found";
        await Spicetify.Player.playUri(track.uri);
        return "Playing " + track.name + " (" + track.uri + ")";
      })()`)
    );
    break;
  case "seek":
    await evaluate(`Spicetify.Player.seek(${Math.round(Number(arg) * 1000)})`);
    break;
  case "lyrics":
    await evaluate(`Spicetify.Platform.History.push("/SpicyLyrics")`);
    break;
  case "ttml": {
    const ttml = readFileSync(arg, "utf8");
    const applied = await evaluate(`window.SpicyLyrics.testing.applyTemporaryTTML(${JSON.stringify(ttml)})`);
    console.log(applied ? "Applied to the playing song" : "Not applied (no song playing, or it didn't parse)");
    break;
  }
  case "eval": {
    const value = await evaluate(arg);
    console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    break;
  }
  case "shot": {
    const reply = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(arg || "spotify.png", Buffer.from(reply.result?.data ?? "", "base64"));
    console.log(`Saved ${arg || "spotify.png"}`);
    break;
  }
  default:
    console.log(readFileSync(import.meta.path, "utf8").split("\n").slice(0, 13).join("\n"));
}

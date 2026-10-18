import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
import { startServer } from "../../../../../tools/serve.js";
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const server = await startServer("C:/work");
const browser = await chromium.launch({args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]});
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
page.on("pageerror", e => console.error("SAYFA", e.message));
await page.goto(server.url + "/zumruduanka/out/tur5/tasarim/gorunum/proto/olc.html");
await page.waitForFunction(() => window.ready, null, {timeout: 30000});
await page.evaluate(() => window.setup({}));
const V = [["g100", {gain: 1.0}], ["g060", {gain: 0.6}], ["g060_rim", {gain: 0.6, rim: [0x9fb4ff, 0.35, 3]}], ["g045_rim", {gain: 0.45, rim: [0x9fb4ff, 0.35, 3]}]];
for (const [n, o] of V){ await page.evaluate(x => window.tune(x), o);
  for (const fr of ["close", "medium"]){ const d = await page.evaluate(f => window.shot(f, "vlitNm"), fr); fs.writeFileSync(path.join(OUT, `ton_${fr}_${n}.png`), Buffer.from(d.split(",")[1], "base64")); } }
await browser.close(); server.close();

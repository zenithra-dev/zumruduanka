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
await page.evaluate(() => window.oda());
const V = [["oda_d0", {gain: 0.8, desat: 0}], ["oda_d06", {gain: 0.8, desat: 0.6}], ["oda_d06_g11", {gain: 1.1, desat: 0.6}]];
for (const [n, o] of V){ await page.evaluate(x => window.tuneAll(x), o);
  for (const fr of ["close", "medium"]){ const d = await page.evaluate(f => window.shot(f, "vlitNm"), fr); fs.writeFileSync(path.join(OUT, `ton_${fr}_${n}.png`), Buffer.from(d.split(",")[1], "base64")); } }
await browser.close(); server.close();

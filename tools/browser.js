// Headless Chromium'da harness sayfasını açar; araçlar buradan window.createSim'e ulaşır.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "./serve.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function ready(page){
  await page.waitForFunction(() => !!window.createSim, null, {timeout: 30000});
  // Tuvale yazılan yazı tipleri (pankart, söz, HUD, oda dokuları) hazır olmadan kare üretilmez; aksi halde kareler arasında yazı tipi değişir.
  // Sayfada canvas-tex.js loadFonts varsa onun bütün listesi (kalınlıklar ve latin-ext dahil), yoksa (SRC ile eski kaynak) eski üçlü.
  const fonts = await page.evaluate(() => Promise.race([
    window.loadFonts ? window.loadFonts(15000) :
    Promise.all(["800 20px 'Big Shoulders Display'", "600 20px Figtree", "500 20px 'JetBrains Mono'"].map(f => document.fonts.load(f, "ZÜMRÜDÜANKA şğıç"))).then(r => r.every(x => x.length > 0)),
    new Promise(r => setTimeout(() => r(false), 15000))]));
  if (!fonts) console.error("UYARI: yazı tipleri yüklenemedi (src/vendor/fonts), yedek yazı tipleriyle devam");
}

export async function openHarness({width = 1280, height = 720} = {}){
  // SRC=yol/src: başka bir kaynak ağacını servis et (ör. eski sürümle ölçüm karşılaştırması); varsayılan bu reponun src'si
  const server = await startServer(process.env.SRC ? path.resolve(process.env.SRC) : path.join(ROOT, "src"));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    // GPU=1: yerel ekran kartıyla çiz (hızlı); yoksa her makinede aynı çıkan yazılım çizimi (swiftshader, CI)
    args: [...(process.env.GPU ? ["--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] : ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]),
      "--autoplay-policy=no-user-gesture-required"]
  });
  const page = await browser.newPage({viewport: {width, height}});
  page.on("pageerror", e => console.error("SAYFA HATASI", e.message));
  page.on("console", m => { if (m.type() === "error") console.error("KONSOL", m.text()); });
  const url = server.url + "/harness.html";
  await page.goto(url, {waitUntil: "domcontentloaded"}); await ready(page);
  return {
    browser, page, server, url: server.url,
    async fresh(){ await page.goto(url, {waitUntil: "domcontentloaded"}); await ready(page); }, // temiz sayfa: yeni bir sim için
    async close(){ await browser.close(); server.close(); }
  };
}

// Türkçe karakterleri sadeleştirip dosya adı üretir: "Kaf Dağı" → "kaf-dagi"
export function slug(name){
  const map = {"ı":"i","ğ":"g","ü":"u","ş":"s","ö":"o","ç":"c","â":"a","î":"i","û":"u","İ":"i","Ğ":"g","Ü":"u","Ş":"s","Ö":"o","Ç":"c"};
  return name.replace(/['’]/g, "").split("").map(c => map[c] || c).join("").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

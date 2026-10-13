// Sıfır bağımlılıklı statik sunucu. ES modülleri file:// üzerinden yüklenmediği için sayfa ve araçlar buradan servis edilir.
// CLI: node tools/serve.js [kök] [port]   → varsayılan src, 8080
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".wav": "audio/wav", ".mp4": "video/mp4", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8"};

export function startServer(root, port = 0){
  root = path.resolve(root);
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let p;
      try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); res.end(); return; }
      let f = path.join(root, p);
      if (!f.startsWith(root)){ res.writeHead(403); res.end(); return; }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      fs.readFile(f, (err, data) => {
        if (err){ res.writeHead(404); res.end("yok: " + p); return; }
        res.writeHead(200, {"Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store"});
        res.end(data);
      });
    });
    srv.on("error", reject);
    srv.listen(port, "127.0.0.1", () => resolve({port: srv.address().port, url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close()}));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const root = process.argv[2] || "src", port = +(process.argv[3] || 8080);
  startServer(root, port).then(s => console.log(`Zümrüdüanka → ${s.url}/  (kök: ${path.resolve(root)})`));
}

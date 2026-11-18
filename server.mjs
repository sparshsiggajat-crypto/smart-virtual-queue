// QueueEase server: one shared queue for every device. No dependencies.
// Run: npm run build && npm start   (then open http://<this-computer>:3001 on any device on the same network)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const file = process.env.DATA_FILE || path.join(root, "data.json");
const PORT = Number(process.env.PORT) || 3001;
let db = {};
try { db = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* first run */ }
const clients = new Map();
let timer;
const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFile(file, JSON.stringify(db), () => {}), 300); };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const key = "v_" + (url.searchParams.get("v") || "bank").replace(/[^a-z0-9_-]/gi, "").slice(0, 30);
  if (url.pathname === "/healthz") return json(res, 200, { ok: true });
  if (url.pathname === "/api/state" && req.method === "GET") return json(res, 200, db[key] ?? { rev: 0, state: null });
  if (url.pathname === "/api/state" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on("end", () => {
      let msg;
      try { msg = JSON.parse(body); } catch { return json(res, 400, { error: "bad json" }); }
      const cur = db[key] ?? { rev: 0, state: null };
      if (msg.rev !== cur.rev) return json(res, 409, cur); // someone else changed it first: client retries on the new state
      if (!msg.state || !Array.isArray(msg.state.tickets)) return json(res, 400, { error: "bad state" });
      db[key] = { rev: cur.rev + 1, state: msg.state };
      save();
      for (const c of clients.get(key) ?? []) c.write(`data: ${JSON.stringify(db[key])}\n\n`);
      json(res, 200, { rev: db[key].rev });
    });
    return;
  }
  if (url.pathname === "/api/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write(": ok\n\n");
    if (!clients.has(key)) clients.set(key, new Set());
    clients.get(key).add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => { clearInterval(ping); clients.get(key).delete(res); });
    return;
  }
  let p = path.join(dist, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname));
  if (!p.startsWith(dist) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, "index.html");
  if (!fs.existsSync(p)) return json(res, 404, { error: "Run npm run build first" });
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] ?? "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, "0.0.0.0", () => console.log(`QueueEase running on http://localhost:${PORT}`));

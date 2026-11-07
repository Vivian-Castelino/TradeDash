import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateTrades } from "../mock-bse/generate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const BSE_URL = process.env.BSE_URL || "http://localhost:4001/getTrades";
const EXPECTED_PULL_MS = Number(process.env.EXPECTED_PULL_MS ?? 15 * 60 * 1000); // UI hint only
const AUTO_PULL = process.env.AUTO_PULL !== "false";
const SSE_RECYCLE_MS = 25_000; // network kills connections > 30s, so we end streams at 25s
const DATA_FILE = path.join(__dirname, "data", "trades.json");
const PULLS_FILE = path.join(__dirname, "data", "pulls.json");

/* ---------------- trade store (persisted) ---------------- */
const trades = new Map();
function loadStore() {
  try {
    for (const t of JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))) trades.set(t.tradeId, t);
  } catch { /* first run */ }
  if (trades.size === 0) {
    // Represents trades pulled by earlier runs, so the dashboard is never empty.
    for (const t of generateTrades(2500)) trades.set(t.tradeId, t);
    persist();
  }
}
function persist() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify([...trades.values()]));
  fs.renameSync(tmp, DATA_FILE);
}

/* ---------------- pull history (persisted) ---------------- */
let pulls = [];
try { pulls = JSON.parse(fs.readFileSync(PULLS_FILE, "utf8")); } catch { /* first run */ }
// a pull still marked running belongs to a previous process that died
pulls = pulls.map((p) => (p.status === "running" ? { ...p, status: "failed", error: "Interrupted by server restart" } : p));
function savePulls() {
  fs.mkdirSync(path.dirname(PULLS_FILE), { recursive: true });
  fs.writeFileSync(PULLS_FILE, JSON.stringify(pulls));
}
function updatePull(id, patch) {
  pulls = pulls.map((p) => (p.pullId === id ? { ...p, ...patch } : p));
  savePulls();
  publish("pulls", { pulls });
}

/* ---------------- event log + SSE fan-out ---------------- */
let seq = 0;
const log = [];            // last N events, for replay after a reconnect
const clients = new Set();
let status = { state: "idle", startedAt: null, expectedMs: EXPECTED_PULL_MS, lastPullAt: null, lastAdded: 0, error: null };

function publish(type, data) {
  const ev = { id: ++seq, type, data };
  log.push(ev);
  if (log.length > 200) log.shift();
  for (const res of clients) send(res, ev);
}
const send = (res, ev) => res.write(`id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`);
function setStatus(patch) { status = { ...status, ...patch }; publish("status", status); }

/* ---------------- ingestor (background pull) ---------------- */
function fetchFromBse(url) {
  // node:http has no default response timeout, so a 15-minute wait is fine here.
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`BSE responded ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function startPull() {
  if (status.state === "pulling") return false;
  const startedAt = Date.now();
  const pullId = `P${String(pulls.length + 1).padStart(3, "0")}`;
  pulls = [...pulls, { pullId, startedAt, durationMs: null, records: null, status: "running", error: null }];
  savePulls();
  setStatus({ state: "pulling", startedAt, error: null });
  publish("pulls", { pulls });
  console.log("[api] pull started");
  fetchFromBse(BSE_URL)
    .then((body) => {
      const fresh = [];
      for (const t of body.trades) if (!trades.has(t.tradeId)) { trades.set(t.tradeId, t); fresh.push(t); }
      persist();
      if (fresh.length) publish("trades", { trades: fresh });
      updatePull(pullId, { status: "completed", durationMs: Date.now() - startedAt, records: body.trades.length });
      setStatus({ state: "idle", startedAt: null, lastPullAt: Date.now(), lastAdded: fresh.length });
      console.log(`[api] pull complete — ${fresh.length} new trades`);
    })
    .catch((e) => {
      console.error("[api] pull failed:", e.message);
      updatePull(pullId, { status: "failed", durationMs: Date.now() - startedAt, error: e.message });
      setStatus({ state: "error", startedAt: null, error: e.message });
    });
  return true;
}

/* ---------------- HTTP API ---------------- */
const app = express();

// Instant snapshot of everything pulled so far (never waits on a pull).
app.get(["/api/trades", "/getTrades"], (_req, res) => {
  res.json({ seq, status, pulls, trades: [...trades.values()] });
});

app.post("/api/pull", (_req, res) => {
  res.status(startPull() ? 202 : 409).json({ status });
});

// Server-Sent Events: push only. Stream is recycled every 25s; the browser
// reconnects with Last-Event-ID and we replay anything it missed.
app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 300\n\n");

  const since = Number(req.get("last-event-id") || req.query.since || 0);
  const gap = since > seq || (since < seq && (log.length === 0 || log[0].id > since + 1));
  if (gap) {
    res.write("event: resync\ndata: {}\n\n");   // client reloads the snapshot
  } else {
    for (const ev of log) if (ev.id > since) send(res, ev);
  }

  clients.add(res);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 10_000);
  const recycle = setTimeout(() => res.end(), SSE_RECYCLE_MS);
  req.on("close", () => { clearInterval(heartbeat); clearTimeout(recycle); clients.delete(res); });
});

const dist = path.join(__dirname, "..", "web", "dist");
if (fs.existsSync(dist)) app.use(express.static(dist));

loadStore();
app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT} — ${trades.size} trades loaded`);
  if (AUTO_PULL) startPull();
});

import { useEffect, useMemo, useState } from "react";
import { useTradeFeed } from "./useTradeFeed.js";

const PAGE = 10;
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const price = (n) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clock12 = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const stamp = (iso) => new Date(iso).toLocaleString("sv-SE").replace("T", " ");

const Icon = ({ children, size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
const IDb = (p) => <Icon {...p}><ellipse cx="12" cy="5" rx="8" ry="3" fill="currentColor" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" fill="currentColor" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" fill="currentColor" /><path d="M4 11c0 1.7 3.6 3 8 3s8-1.3 8-3M4 5c0 1.7 3.6 3 8 3s8-1.3 8-3" stroke="#fff" strokeWidth="1.2" /></Icon>;
const ITrend = (p) => <Icon {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></Icon>;
const IClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l3.5 2" /></Icon>;
const IHourglass = (p) => <Icon {...p}><path d="M6 2h12M6 22h12M7 2v4.5L12 12l-5 5.5V22M17 2v4.5L12 12l5 5.5V22" /></Icon>;
const IRefresh = (p) => <Icon {...p}><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></Icon>;
const IInfo = (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" /></Icon>;
const IWifi = (p) => <Icon {...p}><circle cx="12" cy="12" r="1.5" fill="currentColor" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></Icon>;
const IWifiOff = (p) => <Icon {...p}><path d="M2 8.8a15 15 0 0 1 4-2.6M10 5.2A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 3-1.9M14 11a10 10 0 0 1 5 2M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M2 2l20 20" /></Icon>;
const IHistory = (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Icon>;
const IClose = (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
const ILogo = () => (
  <svg width="48" height="40" viewBox="0 0 48 40" aria-hidden="true">
    <defs><linearGradient id="lg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#2f6df6" /><stop offset="1" stopColor="#35d0c4" /></linearGradient></defs>
    <rect x="2" y="22" width="8" height="16" rx="2" fill="url(#lg)" /><rect x="14" y="14" width="8" height="24" rx="2" fill="url(#lg)" />
    <rect x="26" y="20" width="8" height="18" rx="2" fill="url(#lg)" />
    <path d="m4 18 12-8 10 6 16-14" stroke="url(#lg)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M36 2h8v8" stroke="#35d0c4" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CONN = {
  live: ["Connected", "Live updates active", IWifi],
  connecting: ["Connecting", "Opening event stream...", IRefresh],
  reconnecting: ["Reconnecting", "Restoring event stream...", IRefresh],
  offline: ["Disconnected", "Waiting for connection", IWifiOff],
};
function ConnBadge({ conn }) {
  const [label, note, I] = CONN[conn] || CONN.connecting;
  return (
    <div className={`conn ${conn}`} role="status" aria-live="polite">
      <span className="pill"><I size={16} />{label}</span>
      <span className="note">{note}</span>
    </div>
  );
}

const dur = (ms) => `${Math.floor(ms / 60000)}m ${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}s`;
const started = (ms) => {
  const d = new Date(ms), same = d.toDateString() === new Date().toDateString();
  const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return same ? t : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${t}`;
};

function PullHistory({ pulls }) {
  const list = [...pulls].reverse();
  return (
    <section className="card history">
      <div className="card-head"><h2><IHistory size={22} />Pull History</h2></div>
      <div className="wrap">
        <table>
          <thead><tr><th>Pull ID</th><th>Started</th><th>Duration</th><th className="r">Records</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.pullId}>
                <td>{p.pullId}</td>
                <td>{started(p.startedAt)}</td>
                <td>{p.status === "running" ? "Running" : p.durationMs != null ? dur(p.durationMs) : "—"}</td>
                <td className="r">{p.records != null ? inr.format(p.records) : "—"}</td>
                <td className={`st ${p.status}`}>
                  {p.status === "completed" ? "Completed" : p.status === "running" ? "Running" : "Failed"}
                  {p.error && <small>{p.error}</small>}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} className="empty">No pulls yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const COLS = [
  ["tradeId", "Trade ID"], ["client", "Client"], ["symbol", "Symbol"],
  ["quantity", "Quantity"], ["price", "Price (₹)"], ["value", "Value (₹)"], ["timestamp", "Timestamp"],
];

function pageList(cur, pages) {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i);
  if (cur < 3) return [0, 1, 2, "…", pages - 1];
  if (cur >= pages - 3) return [0, "…", pages - 3, pages - 2, pages - 1];
  return [0, "…", cur - 1, cur, cur + 1, "…", pages - 1];
}

export default function App() {
  const { trades, status, pulls, conn, fresh, toast, startPull } = useTradeFeed();
  const [sort, setSort] = useState({ key: "timestamp", dir: -1 });
  const [q, setQ] = useState("");
  const [fSymbol, setFSymbol] = useState("");
  const [fClient, setFClient] = useState("");
  const [page, setPage] = useState(0);
  const [banner, setBanner] = useState(true);
  const [view_, setView] = useState("dashboard");

  const pulling = status?.state === "pulling";
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!pulling) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [pulling]);
  useEffect(() => { if (pulling) setBanner(true); }, [pulling]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = trades
      .map((t) => ({ ...t, value: t.quantity * t.price }))
      .filter((t) => !needle || `${t.tradeId} ${t.client} ${t.symbol}`.toLowerCase().includes(needle))
      .filter((t) => !fSymbol || t.symbol === fSymbol)
      .filter((t) => !fClient || t.client === fClient);
    list.sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir);
    return list;
  }, [trades, q, fSymbol, fClient, sort]);
  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))].sort(), [trades]);
  const clients = useMemo(() => [...new Set(trades.map((t) => t.client))].sort(), [trades]);
  const filtered = Boolean(q.trim() || fSymbol || fClient);
  const clearFilters = () => { setQ(""); setFSymbol(""); setFClient(""); setPage(0); };

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const view = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const toggle = (key) => { setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 })); setPage(0); };
  const from = rows.length ? cur * PAGE + 1 : 0;
  const to = Math.min(cur * PAGE + PAGE, rows.length);

  const elapsed = pulling && status.startedAt ? Math.max(0, now - status.startedAt) : 0;
  const pct = pulling && status.expectedMs ? Math.min(99, Math.floor((elapsed / status.expectedMs) * 100)) : 0;

  const lastUpdated = status?.lastPullAt ? clock12(status.lastPullAt) : "—";
  const nextPull = pulling ? "In Progress..." : status?.state === "error" ? "Failed" : "Idle";
  const duration = status?.expectedMs ? `~ ${Math.round(status.expectedMs / 60000)} min` : "—";

  const stats = [
    ["blue", IDb, "Total Trades", inr.format(trades.length)],
    ["purple", ITrend, "Last Updated", lastUpdated],
    ["green", IClock, "Next Pull", nextPull],
    ["lilac", IHourglass, "Pull Duration", duration],
  ];

  return (
    <div className="shell">
      <header className="topbar"><div className="brand"><ILogo /><span>TradeDash</span></div>
        <nav className="tabs">
          <button className={view_ === "dashboard" ? "nav on" : "nav"} onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={view_ === "history" ? "nav on" : "nav"} onClick={() => setView("history")}>Pull History</button>
        </nav>
      </header>
      <div className="app">

      <main className="main">
        {banner && (pulling || toast) && (
          <div className="banner" role="status">
            <IInfo size={24} />
            <span>{toast ? `${toast} new trades added from the latest pull.` : "New trade data will be added automatically once the pull completes..."}</span>
            <button aria-label="Dismiss" onClick={() => setBanner(false)}><IClose size={20} /></button>
          </div>
        )}

        <header className="top">
          <div>
            <h1>{view_ === "history" ? "Pull History" : "Trades Dashboard"}</h1>
          </div>
          <div className="right">
            <ConnBadge conn={conn} />
          </div>
        </header>

        {pulling && (
          <div className="progress" role="progressbar" aria-label="Pull progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="p-top">
              <span>Pull in progress</span>
              <span>{dur(elapsed)} elapsed · {pct}%</span>
            </div>
            <div className="track"><div className="fill" style={{ width: `${Math.max(pct, 2)}%` }} /></div>
          </div>
        )}

        {view_ === "dashboard" ? (
        <>
            <div className="stats">
              {stats.map(([tone, I, label, val]) => (
                <div key={label} className={`stat ${tone}`}>
                  <I size={56} />
                  <div><span>{label}</span><b>{val}</b></div>
                </div>
              ))}
            </div>

            <section className="card">
              <div className="card-head">
                <h2><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="11" width="4" height="10" rx="1" /><rect x="10" y="3" width="4" height="18" rx="1" /><rect x="17" y="8" width="4" height="13" rx="1" /></svg>Trade Records</h2>
                <div className="tools">
                  <input type="search" placeholder="Search trade ID, client or symbol" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search trades" />
                  <button className="btn" onClick={startPull} disabled={pulling}><IRefresh size={20} />{pulling ? "Pull running" : "Start pull"}</button>
                </div>
              </div>

              <div className="filters">
                <label>Symbol
                  <select value={fSymbol} onChange={(e) => { setFSymbol(e.target.value); setPage(0); }}>
                    <option value="">All symbols</option>
                    {symbols.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label>Client
                  <select value={fClient} onChange={(e) => { setFClient(e.target.value); setPage(0); }}>
                    <option value="">All clients</option>
                    {clients.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label>Sort by
                  <select value={sort.key} onChange={(e) => { setSort((x) => ({ ...x, key: e.target.value })); setPage(0); }}>
                    {COLS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </label>
                {filtered && <button className="clear" onClick={clearFilters}>Clear filters</button>}
              </div>

              <div className="wrap">
                <table>
                  <thead>
                    <tr>
                      {COLS.map(([k, label]) => (
                        <th key={k} aria-sort={sort.key === k ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                          <button onClick={() => toggle(k)}>{label}{sort.key === k && <span className="arrow">{sort.dir > 0 ? " ▲" : " ▼"}</span>}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.map((t) => (
                      <tr key={t.tradeId} className={fresh.has(t.tradeId) ? "fresh" : ""}>
                        <td>{t.tradeId}</td><td>{t.client}</td><td>{t.symbol}</td>
                        <td>{t.quantity}</td><td>{price(t.price)}</td><td>{inr.format(Math.round(t.value))}</td><td>{stamp(t.timestamp)}</td>
                      </tr>
                    ))}
                    {!view.length && <tr><td colSpan={7} className="empty">{trades.length ? "No trades match this search." : "No trades yet. Start a pull to fetch them."}</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="foot">
                <span>Showing {inr.format(from)} to {inr.format(to)} of {inr.format(rows.length)} trades</span>
                <nav className="pager" aria-label="Pagination">
                  <button disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page">‹</button>
                  {pageList(cur, pages).map((p, i) => p === "…"
                    ? <span key={`e${i}`} className="gap">...</span>
                    : <button key={p} className={p === cur ? "on" : ""} onClick={() => setPage(p)}>{p + 1}</button>)}
                  <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page">›</button>
                </nav>
              </div>
            </section>
        </>
        ) : (
          <PullHistory pulls={pulls} />
        )}
      </main>
      </div>
    </div>
  );
}

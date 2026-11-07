import { useEffect, useRef, useState } from "react";

// 1) load an instant snapshot  2) open an SSE stream from that snapshot's seq.
// The server ends the stream every ~25s (network limit is 30s); EventSource
// reconnects on its own and the server replays missed events via Last-Event-ID.
export function useTradeFeed() {
  const [trades, setTrades] = useState([]);
  const [status, setStatus] = useState(null);
  const [pulls, setPulls] = useState([]);
  const [conn, setConn] = useState("connecting");
  const [fresh, setFresh] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const known = useRef(new Set());

  useEffect(() => {
    let es, dead = false, t1, t2;

    async function load() {
      try {
        const d = await (await fetch("/api/trades")).json();
        if (dead) return;
        known.current = new Set(d.trades.map((t) => t.tradeId));
        setTrades(d.trades);
        setStatus(d.status);
        setPulls(d.pulls || []);
        connect(d.seq);
      } catch {
        setConn("offline");
        setTimeout(load, 2000); // only for an unreachable API, not for data
      }
    }

    function connect(since) {
      es = new EventSource(`/api/stream?since=${since}`);
      es.onopen = () => { clearTimeout(t1); clearTimeout(t2); t1 = t2 = null; setConn("live"); };
      es.onerror = () => {
        // the server recycles the stream every ~25s, so only show a problem if it lasts.
        // Timers start on the first error and are not reset by the retries that follow.
        if (!t1) t1 = setTimeout(() => setConn("reconnecting"), 1500);
        if (!t2) t2 = setTimeout(() => setConn("offline"), 8000);
      };
      es.addEventListener("pulls", (e) => setPulls(JSON.parse(e.data).pulls));
      es.addEventListener("status", (e) => setStatus(JSON.parse(e.data)));
      es.addEventListener("resync", () => { es.close(); load(); });
      es.addEventListener("trades", (e) => {
        const incoming = JSON.parse(e.data).trades.filter((t) => !known.current.has(t.tradeId));
        if (!incoming.length) return;
        incoming.forEach((t) => known.current.add(t.tradeId));
        setTrades((prev) => [...prev, ...incoming]);
        const ids = new Set(incoming.map((t) => t.tradeId));
        setFresh(ids);
        setToast(incoming.length);
        setTimeout(() => setFresh(new Set()), 8000);
        setTimeout(() => setToast(null), 8000);
      });
    }

    load();
    return () => { dead = true; clearTimeout(t1); clearTimeout(t2); es && es.close(); };
  }, []);

  const startPull = () => fetch("/api/pull", { method: "POST" });
  return { trades, status, pulls, conn, fresh, toast, startPull };
}

import express from "express";
import { generateTrades } from "./generate.js";

const PORT = process.env.BSE_PORT || 4001;
const DEFAULT_DELAY = Number(process.env.DELAY_MS ?? 15 * 60 * 1000); // 15 minutes
const BASE = 3000, GROWTH = 250;
let completedPulls = 0;

const app = express();

// Holds the connection open for the configured delay, then returns the trades.
// Override per request with ?delay=<ms>.
app.get("/getTrades", (req, res) => {
  const delay = Number(req.query.delay ?? DEFAULT_DELAY);
  const count = BASE + completedPulls * GROWTH;
  console.log(`[mock-bse] /getTrades requested — responding in ${Math.round(delay / 1000)}s with ${count} trades`);
  const timer = setTimeout(() => {
    completedPulls++;
    res.json({ source: "MOCK-BSE", delayMs: delay, count, trades: generateTrades(count) });
    console.log("[mock-bse] pull delivered");
  }, delay);
  res.on("close", () => clearTimeout(timer));
});

const server = app.listen(PORT, () =>
  console.log(`[mock-bse] http://localhost:${PORT}/getTrades (delay ${DEFAULT_DELAY} ms)`));
server.requestTimeout = 0;
server.timeout = 0;

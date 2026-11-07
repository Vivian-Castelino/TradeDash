// Deterministic trade generator: trade #i is always the same, so a later
// pull returns the earlier trades plus new ones (like a growing exchange tape).
const SYMBOLS = {
  RELIANCE: 2900, TCS: 4100, INFY: 1850, HDFCBANK: 1620, ICICIBANK: 1210,
  SBIN: 830, ITC: 465, LT: 3550, AXISBANK: 1180, BHARTIARTL: 1540,
  KOTAKBANK: 1760, MARUTI: 12400, TATAMOTORS: 960, WIPRO: 520, ONGC: 285,
};
const CLIENTS = ["Aarav Capital", "Bhadra Securities", "Cobalt Wealth", "Dhruv Traders", "Eka Investments",
  "Falcon Asset Mgmt", "Gati Holdings", "Himalaya Funds", "Indus Equities", "Jal Brokers",
  "Kaveri Partners", "Lotus Trading", "Meru Advisors", "Nila Finance", "Orion Markets"];
const SESSION_OPEN = Date.parse("2026-11-06T03:45:00Z"); // 09:15 IST

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTrades(count, offset = 0) {
  const names = Object.keys(SYMBOLS);
  const out = [];
  for (let i = offset; i < offset + count; i++) {
    const r = rng(i * 7919 + 13);
    const symbol = names[Math.floor(r() * names.length)];
    const price = +(SYMBOLS[symbol] * (0.97 + r() * 0.06)).toFixed(2);
    out.push({
      tradeId: `BSE-${String(i + 1).padStart(6, "0")}`,
      client: CLIENTS[Math.floor(r() * CLIENTS.length)],
      symbol,
      quantity: (1 + Math.floor(r() * 200)) * 5,
      price,
      timestamp: new Date(SESSION_OPEN + i * 6000 + Math.floor(r() * 5000)).toISOString(),
    });
  }
  return out;
}

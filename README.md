# BSE Trades Dashboard

A mock BSE exchange API (a pull takes 15 minutes) and a React dashboard that opens instantly with the trades
already pulled, then receives new trades automatically when a pull completes. No page refresh, no polling loop,
no cron job or scheduler, and no browser connection is ever held open for more than 30 seconds.

## Setup

Requires Node.js 18 or newer.

```bash
npm install
npm run demo   # pull takes 45 seconds
npm run dev    # pull takes the real 15 minutes
```

Open http://localhost:5173.

| Service | Port | Role |
|---|---|---|
| `mock-bse` | 4001 | `GET /getTrades`: returns 3,000+ seeded trades after `DELAY_MS` (default 900000 = 15 min) |
| `server` | 4000 | Runs the pull in the background, stores trades and pull history, serves a snapshot and a live stream |
| `web` | 5173 | React dashboard (Vite, proxies `/api` to port 4000) |

Single-process production style: `npm run build && npm run start`. The API then serves the built dashboard on
http://localhost:4000.

### Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `DELAY_MS` | 900000 | How long the mock BSE holds `/getTrades` before answering. Can also be set per request with `?delay=<ms>` |
| `EXPECTED_PULL_MS` | 900000 | Used only to estimate the progress bar |
| `AUTO_PULL` | true | Set to `false` to stop the server starting a pull when it boots |
| `BSE_URL` | `http://localhost:4001/getTrades` | Where the server pulls from |
| `PORT`, `BSE_PORT` | 4000, 4001 | Ports of the API server and the mock BSE |

## What the dashboard shows

- **Dashboard page:** stat cards (total trades, last updated, next pull, expected pull duration) and a table of
  trade records with search, symbol and client filters, sorting (by the Sort by menu or by clicking a column header)
  and pagination. A **Start pull** button starts another pull.
- **Pull progress:** while a pull runs, a progress bar shows the elapsed time and an estimated percentage. The
  estimate is based on `EXPECTED_PULL_MS`, because BSE sends nothing until the pull is complete.
- **Pull History page** (from the top bar): every pull with its ID, start time, duration, record count and status
  (Running, Completed or Failed, with the error message for a failed pull). History is saved to
  `server/data/pulls.json` and survives restarts.
- **Connection indicator** (top right): *Connected* (live updates active), *Reconnecting* (restoring the event
  stream) or *Disconnected* (waiting for connection). The server ends each stream every 25 seconds by design, so the
  badge only changes if the connection stays down for more than about 1.5 seconds (Reconnecting) or 8 seconds
  (Disconnected).

## What to try

1. Start the app with `npm run demo`. The dashboard opens immediately with 2,500 stored trades while the first
   pull runs, and the progress bar fills.
2. Refresh the page in the middle of the pull. It still loads instantly and the progress bar picks up from the
   server's clock.
3. Wait for the pull to finish. The new trades are pushed in and highlighted, and the page is not refreshed.
4. Open **Pull History** to see the pull listed with its duration and record count.
5. Press **Start pull** for another pull. Each pull adds 500 more trades.
6. Stop the API for a few seconds and the badge changes to Reconnecting, then Disconnected. Start it again and the
   app catches up on its own.

## Endpoints

- `GET /getTrades` (mock BSE, :4001): slow, as the real BSE. Takes `?delay=<ms>`.
- `GET /api/trades` (also `/getTrades` on :4000): instant snapshot with the stored trades, the pull status, the
  pull history and the current event number (`seq`).
- `GET /api/stream?since=<seq>`: Server-Sent Events with the events `trades`, `status`, `pulls` and `resync`. Ends
  every 25 seconds. The browser reconnects and sends `Last-Event-ID`, and the server replays what it missed.
- `POST /api/pull`: starts a pull (returns 409 if one is already running).

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and diagram.

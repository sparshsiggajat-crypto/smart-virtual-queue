# QueueEase: Smart Virtual Queue

React + TypeScript + Vite demo. Customers join a line, get a digital token, watch a live wait time and are alerted before their turn. Staff run each counter. Queue state lives in the browser and syncs across tabs.

## Run for real (one shared queue for every device)
```
npm install
npm start
```
Open `http://localhost:3001`. On the same Wi-Fi, other devices use `http://<this-computer-IP>:3001`. The queue is saved in `data.json` and survives restarts. Use `#customer`, host and head consoles from any device.

## Develop
```
npm run server   # terminal 1
npm run dev      # terminal 2 (proxies /api to the server)
```
Without the server the app still works as a browser-only demo.
Open `http://localhost:5173/#customer` in one tab and `#staff` in another to see them stay in sync.

## Screens
- `#customer` pick a service, get a token, see your place and turn alert (3 simple steps)
- `#board` live line and counter windows
- `#staff` call next, recall, mark served, no-show, remove, live feed
- `#analytics` wait chart, arrivals, service targets, searchable token audit
- `#simulation` run a full queue simulation: set arrivals, counters, service time and patience, watch the line live, and compare 1 to 8 counters over a simulated 8 hour day

## Notes
- Wait time is learned from the last 6 completed visits per service, blended with the default in `src/data/services.ts`.
- Priority tickets are served before standard ones.
- "Demo tools" (top right) has Auto-play and Reset. Turn Auto-play on in one tab only.
- Next steps for production: a backend (WebSockets) for a shared queue, SMS or push alerts, staff login.

## Venue presets and extra features
- Use "Type of place" in the top bar: Bank, Hospital or clinic, Government office, Salon or shop, College. Each has its own services and counters (edit `src/data/services.ts` to add your own).
- Staff can post a notice for everyone and take a counter on a break.
- Live board can announce calls out loud and copy a join link.
- Customers see an expected turn time and can rate their visit; Reports shows satisfaction.

## Role consoles
Pick Customer, Host or Head in the bar under the header. Host and Head ask for a PIN (demo: Host 1111, Head 1234; change `PINS` in `src/App.tsx`).
- **Customer:** get a token, live board.
- **Host (front desk):** issue tokens to walk-ins, call people, post notices.
- **Head:** control room (pause counters, join QR code, CSV download), reports, simulator.
- Language: English and Hindi. Add more in `src/lib/i18n.ts`.
- WhatsApp and SMS: one-tap buttons open the app with the message ready. Automatic sending needs a backend.

## Deploy (Render, free)
1. Push this folder to a GitHub repository.
2. On render.com choose New, then Blueprint, pick the repository. `render.yaml` sets everything up.
3. Open the URL Render gives you. Share `<url>/#customer` (or the QR code in the Head console) with customers.

Docker also works: `docker build -t queueease . && docker run -p 3001:3001 -v queue-data:/data queueease`.
Notes: free hosting sleeps when idle and may clear `data.json` on restart (a paid disk mounted at `/data`, with `DATA_FILE=/data/data.json`, keeps it). Before real public use, replace the demo PINs with server-side login.

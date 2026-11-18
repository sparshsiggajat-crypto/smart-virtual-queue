import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { SERVICES, VENUE, VENUE_KEY, serviceById } from "../data/services.ts";
import { formatMinutes } from "../lib/time.ts";
import { avgServiceSec, currentCalled, useQueue, waitingTickets } from "../store/queueStore.tsx";

export function HeadView() {
  const { tickets, paused, togglePause } = useQueue();
  const url = `${window.location.href.split("#")[0]}#customer`;
  const svg = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(url);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [url]);

  const download = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : "");
    const head = ["Token", "Name", "Phone", "Service", "Status", "Priority", "Joined", "Called", "Finished", "Wait (min)", "Rating"];
    const rows = tickets.map((t) => [t.token, t.name, t.phone, serviceById(t.serviceId).name, t.status, t.priority ? "yes" : "no", iso(t.joinedAt), iso(t.calledAt), iso(t.finishedAt), t.calledAt ? ((t.calledAt - t.joinedAt) / 60000).toFixed(1) : "", t.rating]);
    const csv = [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `queueease-${VENUE_KEY}-report.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <h1>Control room</h1>
      <p className="muted">{VENUE.name}, {VENUE.place}. Oversee every counter, share the join link and export records.</p>
      <div className="wins">
        {SERVICES.map((s) => {
          const cur = currentCalled(tickets, s.id);
          return (
            <div className="card" key={s.id}>
              <div className="row"><h2>{s.name}</h2><span className={`tag ${paused[s.id] ? "r" : cur ? "g" : "b"}`}>{paused[s.id] ? "On break" : cur ? `Serving ${cur.token}` : "Free"}</span></div>
              <p className="muted">{waitingTickets(tickets, s.id).length} waiting · {formatMinutes(avgServiceSec(tickets, s))} average service</p>
              <button type="button" className="btn s" style={{ marginTop: 10 }} onClick={() => togglePause(s.id)}>{paused[s.id] ? "Resume counter" : "Pause counter"}</button>
            </div>
          );
        })}
      </div>
      <div className="g3b">
        <div className="card">
          <h2>Join by QR code</h2>
          <p className="muted">Print this and place it at the entrance. People scan it to get a token.</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(url)}>Copy join link</button>
        </div>
        <div className="card">
          <h2>Download records</h2>
          <p className="muted">Every token with service, times, wait and rating, as a CSV file for Excel or Google Sheets.</p>
          <button type="button" className="btn p" onClick={download}>Download CSV report</button>
          <p className="hint">Works in the downloaded project. Some preview windows block file downloads.</p>
        </div>
        <div className="card">
          <h2>WhatsApp and SMS alerts</h2>
          <p className="muted">People can add a mobile number. Staff then get one-tap WhatsApp and SMS buttons with the message ready to send.</p>
          <p className="hint">Fully automatic sending needs a server and a provider such as Twilio, Gupshup or the WhatsApp Business API.</p>
        </div>
      </div>
    </>
  );
}

import { useState } from "react";
import { SERVICES, type ServiceId } from "../data/services.ts";
import { BarChart, LineChart } from "../components/Charts.tsx";
import { ServiceTabs } from "../components/ServiceTabs.tsx";
import { formatTime } from "../lib/time.ts";
import { useQueue, type Ticket } from "../store/queueStore.tsx";

const SLA_MIN = 10;
const FILTERS = ["All", "Waiting", "Serving", "Done", "Left"] as const;
type Filter = (typeof FILTERS)[number];

const label = (t: Ticket): Filter | "No-show" => (t.status === "waiting" ? "Waiting" : t.status === "called" ? "Serving" : t.status === "done" ? "Done" : t.status === "skipped" ? "No-show" : "Left");
const waitMin = (t: Ticket, now: number) => ((t.calledAt ?? (t.status === "waiting" ? now : t.finishedAt ?? now)) - t.joinedAt) / 60_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function AnalyticsView() {
  const { tickets, now } = useQueue();
  const [svc, setSvc] = useState<ServiceId | "all">("all");
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  const scope = tickets.filter((t) => svc === "all" || t.serviceId === svc);
  const called = scope.filter((t) => t.calledAt).sort((a, b) => (a.calledAt ?? 0) - (b.calledAt ?? 0));
  const waits = called.map((t) => waitMin(t, now));
  const done = scope.filter((t) => t.status === "done").length;
  const left = scope.filter((t) => t.status === "cancelled" || t.status === "skipped").length;
  const rated = scope.filter((t) => t.rating).map((t) => t.rating as number);
  const peak = Math.max(0, ...SERVICES.map((s) => tickets.filter((t) => t.serviceId === s.id && t.status === "waiting").length));
  const buckets = Array.from({ length: 8 }, (_, i) => scope.filter((t) => now - t.joinedAt >= (7 - i) * 600_000 && now - t.joinedAt < (8 - i) * 600_000).length);
  const labels = buckets.map((_, i) => (i === 7 ? "now" : `-${(7 - i) * 10}m`));
  const rows = scope
    .filter((t) => (filter === "All" || (filter === "Left" ? t.status === "cancelled" || t.status === "skipped" : label(t) === filter)) && `${t.token} ${t.name}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .slice(0, 12);

  return (
    <>
      <div className="row"><div><h1>Reports</h1><p className="muted">Simple numbers on waiting times and visitors.</p></div><ServiceTabs all value={svc} onChange={setSvc} /></div>
      <div className="g4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        {[
          ["Average wait", `${avg(waits).toFixed(1)} min`, `Target ${SLA_MIN} min`],
          ["Visitors served", String(done), "Completed visits"],
          ["Longest line", String(peak), "Across service lines, right now"],
          ["Left or no-show", String(left), `${((100 * left) / Math.max(1, left + done)).toFixed(1)}% drop-off`],
          ["Satisfaction", rated.length ? `${avg(rated).toFixed(1)} / 5` : "–", `${rated.length} ${rated.length === 1 ? "rating" : "ratings"}`],
        ].map(([k, v, n]) => <div className="card kpi" key={k}><small>{k}</small><b>{v}</b><span className="muted">{n}</span></div>)}
      </div>
      <div className="g2" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <div className="card"><h2>Wait time by call</h2><p className="muted">Minutes each person waited before being called.</p><LineChart values={waits.slice(-24)} sla={SLA_MIN} unit="min" /></div>
        <div className="card"><h2>Arrivals per 10 minutes</h2><p className="muted">Busiest period is highlighted.</p><BarChart values={buckets} labels={labels} /></div>
      </div>
      <div className="g3b">
        {SERVICES.map((s) => {
          const w = avg(tickets.filter((t) => t.serviceId === s.id && t.calledAt).map((t) => waitMin(t, now)));
          const state: [string, string] = w <= SLA_MIN ? ["Passing", "g"] : w <= SLA_MIN * 1.3 ? ["Attention", "b"] : ["Breached", "r"];
          return (
            <div className="card" key={s.id}>
              <div className="row"><h2>{s.name}</h2><span className={`tag ${state[1]}`}>{state[0]}</span></div>
              <p className="muted">Average wait</p>
              <b style={{ fontSize: 30 }}>{w.toFixed(1)} min</b><span className="muted"> / {SLA_MIN} target</span>
              <div className="bar"><i style={{ width: `${Math.min(100, (w / SLA_MIN) * 100)}%`, background: w > SLA_MIN ? "var(--ter)" : "var(--pri)" }} /></div>
              <span className="muted">{tickets.filter((t) => t.serviceId === s.id && t.status === "done").length} served</span>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="row">
          <h2>Token audit</h2>
          <div className="row">
            <input aria-label="Search tokens" placeholder="Search token or name" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
            <div className="seg">{FILTERS.map((f) => <button key={f} type="button" className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>)}</div>
          </div>
        </div>
        <div className="tw" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Token</th><th>Name</th><th>Service</th><th>Check-in</th><th>Wait</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><span className="tag g">{t.token}</span></td>
                  <td>{t.name}{t.priority && " ★"}</td>
                  <td>{SERVICES.find((s) => s.id === t.serviceId)?.name}</td>
                  <td>{formatTime(t.joinedAt)}</td>
                  <td>{waitMin(t, now).toFixed(1)} min</td>
                  <td><span className={`tag ${t.status === "called" ? "g" : t.status === "waiting" ? "b" : t.status === "done" ? "" : "r"}`}>{label(t)}</span></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="empty">No tokens match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

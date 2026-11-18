import { useState } from "react";
import { ConfirmButton } from "../components/ConfirmButton.tsx";
import { NotifyLinks } from "../components/NotifyLinks.tsx";
import { SERVICES, serviceById, type ServiceId } from "../data/services.ts";
import { ServiceTabs } from "../components/ServiceTabs.tsx";
import { formatClock, formatDuration, formatTime } from "../lib/time.ts";
import { avgServiceSec, currentCalled, useQueue, waitingTickets } from "../store/queueStore.tsx";

export function StaffView() {
  const { tickets, now, callNext, recall, markServed, skip, cancel, notice, paused, setNotice, togglePause } = useQueue();
  const [draft, setDraft] = useState(notice);
  const [id, setId] = useState<ServiceId>(SERVICES[0].id);
  const service = serviceById(id);
  const line = waitingTickets(tickets, id);
  const current = currentCalled(tickets, id);
  const mineToday = tickets.filter((t) => t.serviceId === id);
  const served = mineToday.filter((t) => t.status === "done").length;
  const events = tickets
    .filter((t) => t.serviceId === id)
    .flatMap((t) => [
      { ts: t.joinedAt, text: `${t.name} joined as ${t.token}` },
      ...(t.calledAt ? [{ ts: t.calledAt, text: `${t.token} called to ${service.counter}` }] : []),
      ...(t.finishedAt ? [{ ts: t.finishedAt, text: `${t.token} ${t.status === "done" ? "served" : t.status === "skipped" ? "marked no-show" : "left the line"}` }] : []),
    ])
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10);

  return (
    <>
      <div className="row"><div><h1>Staff desk</h1><p className="muted">Pick your counter, then call people one at a time.</p></div><ServiceTabs value={id} onChange={(v) => v !== "all" && setId(v)} /></div>
      <div className="g3b">
        <div className="card kpi"><small>People waiting</small><b>{line.length}</b><span className="muted">{line.filter((t) => t.priority).length} priority</span></div>
        <div className="card kpi"><small>Served today</small><b>{served}</b><span className="muted">Avg service {formatDuration(avgServiceSec(tickets, service))}</span></div>
        <div className="card kpi"><small>Counters open</small><b>{SERVICES.filter((s) => currentCalled(tickets, s.id)).length} / {SERVICES.length}</b><span className="muted">With someone at the window</span></div>
      </div>
      <div className="card g3b" style={{ gridTemplateColumns: "1.2fr 1fr 1fr", alignItems: "center" }}>
        <div><span className="tag g">{service.counter}</span><h1 style={{ marginTop: 10 }}>{service.name}</h1><p className="muted">{service.blurb}</p></div>
        <div className="stage"><small className="muted">Now serving</small><b>{current?.token ?? "–"}</b>{current ? <><span>{current.name}</span><br /><span className="muted">{formatClock(current.calledAt ?? now, now)} elapsed</span>{current.phone && <NotifyLinks phone={current.phone} text={`Token ${current.token}: please go to ${service.counter}.`} />}</> : <span className="muted">Counter free</span>}</div>
        <div>
          <button type="button" className="btn p" disabled={Boolean(current) || !line.length || Boolean(paused[id])} onClick={() => callNext(id)}>{line.length && !current ? `Call next (${line[0].token})` : "Call next"}</button>
          {current && <p className="hint">Finish or skip {current.token} to call the next person.</p>}
          {!current && !line.length && <p className="hint">No one is waiting right now.</p>}
          <button type="button" className="btn" disabled={!current} onClick={() => recall(id)}>Recall</button>
          <button type="button" className="btn" onClick={() => togglePause(id)}>{paused[id] ? "Resume counter" : "Take a break"}</button>
          <button type="button" className="btn" disabled={!current} onClick={() => markServed(id)}>Mark served</button>
          <ConfirmButton className="btn d" disabled={!current} onConfirm={() => skip(id)}>No-show</ConfirmButton>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Notice for everyone</h2>
        <p className="muted">Shown on the customer page and live board, for example “Doctor is running 15 minutes late”.</p>
        <form className="noticeform" onSubmit={(e) => { e.preventDefault(); setNotice(draft.trim()); }}>
          <input value={draft} maxLength={140} onChange={(e) => setDraft(e.target.value)} placeholder="Type a notice" aria-label="Notice text" />
          <button type="submit" className="btn p s">Post</button>
          <button type="button" className="btn s" onClick={() => { setDraft(""); setNotice(""); }}>Clear</button>
        </form>
      </div>
      <div className="g2" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <div className="card">
          <h2>Waiting line</h2>
          {line.length === 0 ? <p className="empty">Nobody waiting. Share the customer link to add people.</p> : (
            <ul className="list">
              {line.map((t, i) => (
                <li key={t.id}>
                  <span><span className="tag g">{t.token}</span> <b>{t.name}</b>{t.priority && <span className="tag r" style={{ marginLeft: 6 }}>Priority</span>}<br /><span className="muted">#{i + 1} · waiting {formatClock(t.joinedAt, now)}</span></span>
                  <ConfirmButton className="btn s" onConfirm={() => cancel(t.id)}>Remove</ConfirmButton>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="row"><h2>Live feed</h2><span className="live">Realtime</span></div>
          <ul className="feed">{events.map((e, i) => <li key={i}><b>{formatTime(e.ts)}</b> {e.text}</li>)}</ul>
        </div>
      </div>
    </>
  );
}

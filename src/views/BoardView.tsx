import { useEffect, useRef, useState } from "react";
import { SERVICES, serviceById, type ServiceId } from "../data/services.ts";
import { ServiceTabs } from "../components/ServiceTabs.tsx";
import { formatMinutes } from "../lib/time.ts";
import { avgServiceSec, currentCalled, etaSeconds, useQueue, waitingTickets } from "../store/queueStore.tsx";

export function BoardView() {
  const { tickets, now, myTicketId, paused } = useQueue();
  const [voice, setVoice] = useState(false);
  const [copied, setCopied] = useState(false);
  const mine = tickets.find((t) => t.id === myTicketId && (t.status === "waiting" || t.status === "called")) ?? null;
  const [id, setId] = useState<ServiceId>(mine?.serviceId ?? SERVICES[0].id);
  const service = SERVICES.find((s) => s.id === id) ?? SERVICES[0];
  const line = waitingTickets(tickets, id);
  const latest = tickets.filter((t) => t.status === "called").sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0))[0];
  const callKey = latest ? `${latest.id}:${latest.recallCount}` : "";
  const lastCall = useRef(callKey);
  useEffect(() => {
    if (voice && latest && callKey !== lastCall.current && typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(`Token ${latest.token.replace("-", " ")}, please go to ${serviceById(latest.serviceId).counter}`));
    }
    lastCall.current = callKey;
  }, [voice, callKey]);
  const shown = line.slice(0, 8);
  const mineHidden = mine && mine.serviceId === id && mine.status === "waiting" && !shown.some((t) => t.id === mine.id);

  return (
    <>
      {latest && (
        <div className="banner" role="status">
          Now calling {latest.token} to {SERVICES.find((s) => s.id === latest.serviceId)?.counter}
        </div>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="chk" style={{ margin: 0 }}><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />Announce calls out loud</label>
        <button type="button" className="btn s" onClick={() => { navigator.clipboard?.writeText(`${window.location.href.split("#")[0]}#customer`); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? "Link copied" : "Copy join link"}</button>
      </div>
      <div className="row"><div><h1>Live board</h1><p className="muted">Pick a service to see its line. Front of the line is on the left.</p></div><ServiceTabs value={id} onChange={(v) => v !== "all" && setId(v)} /></div>
      <div className="g4">
        <div className="card kpi"><small>In line</small><b>{line.length}</b></div>
        <div className="card kpi"><small>Avg service time</small><b>{formatMinutes(avgServiceSec(tickets, service))}</b></div>
        <div className="card kpi"><small>Now serving</small><b>{currentCalled(tickets, id)?.token ?? "–"}</b></div>
        <div className="card kpi me"><small>Your token</small><b>{mine?.token ?? "–"}</b></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Live line</h2>
        
        <div className="belt">
          {shown.length === 0 && <div className="empty" style={{ width: "100%" }}>No one waiting. Walk right in.</div>}
          {shown.map((t, i) =>
            t.id === mine?.id ? (
              <div className="mytk" key={t.id}><i>Your ticket</i><b>{t.token}</b><small>{i} ahead</small></div>
            ) : (
              <div className={i === 0 ? "tk f" : "tk"} key={t.id}>{t.token}<small>~{formatMinutes(etaSeconds(t, tickets, service, now))}</small></div>
            ),
          )}
          {line.length > shown.length && <div className="muted" style={{ flex: "none" }}>+{line.length - shown.length} more</div>}
          {mineHidden && mine && <div className="mytk"><i>Your ticket</i><b>{mine.token}</b><small>{line.findIndex((t) => t.id === mine.id)} ahead</small></div>}
        </div>
      </div>
      <h2 style={{ marginTop: 22 }}>Counter windows</h2>
      <div className="wins">
        {SERVICES.map((s) => {
          const cur = currentCalled(tickets, s.id);
          const yours = cur && cur.id === mine?.id;
          return (
            <div key={s.id} className={yours ? "win me" : "win"}>
              <div className="row"><span className="tag">{s.counter}</span>{cur ? <span className="tag g">Serving</span> : paused[s.id] ? <span className="tag r">On break</span> : <span className="tag b">Free</span>}</div>
              <p style={{ margin: "10px 0 0", fontWeight: 700 }}>{s.name}</p>
              <div className="srv">{yours ? "Your turn" : cur ? "Serving token" : "Ready for next"}<b>{cur?.token ?? "–"}</b>{cur ? `${Math.round((now - (cur.calledAt ?? now)) / 1000)}s elapsed` : `${waitingTickets(tickets, s.id).length} waiting`}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

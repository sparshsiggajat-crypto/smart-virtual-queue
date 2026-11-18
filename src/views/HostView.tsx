import { useState } from "react";
import { NotifyLinks } from "../components/NotifyLinks.tsx";
import { ServiceTabs } from "../components/ServiceTabs.tsx";
import { SERVICES, serviceById, type ServiceId } from "../data/services.ts";
import { currentCalled, useQueue, waitingTickets } from "../store/queueStore.tsx";

type Issued = { token: string; name: string; service: string; ahead: number; phone: string };

export function HostView() {
  const { tickets, walkIn } = useQueue();
  const [id, setId] = useState<ServiceId>(SERVICES[0].id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const service = serviceById(id);

  const issue = () => {
    const ahead = waitingTickets(tickets, id).filter((x) => !priority || x.priority).length + (currentCalled(tickets, id) ? 1 : 0);
    const token = walkIn(id, name, { priority, phone });
    setIssued({ token, name: name.trim() || "Walk-in", service: service.name, ahead, phone });
    setName(""); setPhone(""); setPriority(false);
  };

  return (
    <>
      <h1>Front desk</h1>
      <p className="muted">Add people who walk in without a phone, then give them their token.</p>
      <div className="g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <form className="card" onSubmit={(e) => { e.preventDefault(); issue(); }}>
          <h2>New walk-in</h2>
          <div style={{ marginTop: 10 }}><ServiceTabs value={id} onChange={(v) => v !== "all" && setId(v)} /></div>
          <label htmlFor="hn">Name <span className="muted">(optional)</span></label>
          <input id="hn" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" />
          <label htmlFor="hp">Mobile number <span className="muted">(optional, for WhatsApp or SMS)</span></label>
          <input id="hp" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
          <label className="chk"><input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} />Priority (senior citizen or accessibility need)</label>
          <button type="submit" className="btn p">Issue token for {service.name}</button>
        </form>
        <div className="card">
          {issued ? (
            <div className="stage">
              <small className="muted">Give this token to {issued.name}</small>
              <b>{issued.token}</b>
              <span>{issued.service}</span><br />
              <span className="muted">{issued.ahead} {issued.ahead === 1 ? "person" : "people"} ahead</span>
              {issued.phone && <NotifyLinks phone={issued.phone} text={`Your QueueEase token is ${issued.token} for ${issued.service}. ${issued.ahead} ahead of you.`} />}
            </div>
          ) : <p className="empty">The new token will appear here.</p>}
        </div>
      </div>
    </>
  );
}

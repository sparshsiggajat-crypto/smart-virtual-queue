import { useState } from "react";
import { ConfirmButton } from "../components/ConfirmButton.tsx";
import { t } from "../lib/i18n.ts";
import { SERVICES, VENUE, serviceById, type ServiceId } from "../data/services.ts";
import { formatDuration, formatMinutes, formatTime } from "../lib/time.ts";
import { currentCalled, etaSeconds, joinEtaSeconds, peopleAhead, useQueue, waitingTickets } from "../store/queueStore.tsx";

function ordinal(n: number) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${suffix}`;
}

export function CustomerView() {
  const { tickets, now, myTicketId, join, cancel, clearMyTicket, paused, rate } = useQueue();
  const mine = tickets.find((t) => t.id === myTicketId) ?? null;
  const holding = mine !== null && (mine.status === "waiting" || mine.status === "called");
  const [selected, setSelected] = useState<ServiceId | null>(mine?.serviceId ?? null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState(false);
  const [alertAhead, setAlertAhead] = useState(2);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

  const focusId = holding && mine ? mine.serviceId : selected;
  const service = focusId ? serviceById(focusId) : null;
  const mineService = mine ? serviceById(mine.serviceId) : null;
  const ahead = mine ? peopleAhead(mine, tickets) : 0;
  const eta = mine && mineService ? etaSeconds(mine, tickets, mineService, now) : 0;
  const elapsed = mine ? (now - mine.joinedAt) / 1000 : 0;
  const pct = mine?.status === "called" ? 100 : Math.max(5, Math.round((elapsed / Math.max(1, elapsed + eta)) * 100));
  const step = holding ? 3 : selected ? 2 : 1;

  const enableAlerts = async () => {
    if (typeof Notification !== "undefined") setPerm(await Notification.requestPermission());
  };

  const statusLabel = !mine ? "" : mine.status === "waiting" ? `${ordinal(ahead + 1)} in line` : mine.status === "called" ? "Your turn" : mine.status === "done" ? "Served" : mine.status === "skipped" ? "Missed your turn" : "You left the line";

  return (
    <>
      <div className="hero"><h1>{t("Skip the wait. Get a token.")}</h1>
      <p>{t("No need to stand in line. Get a digital token and we’ll tell you when it’s your turn.")}</p>
      <div className="chips"><span className="chip">📍 {VENUE.name}, {VENUE.place}</span><span className="chip">👥 {tickets.filter((x) => x.status === "waiting").length} waiting now</span></div></div>
      <ol className="steps" aria-label="How it works">
        <li className={step === 1 ? "now" : ""}><i>1</i>{t("Choose a service")}</li>
        <li className={step === 2 ? "now" : ""}><i>2</i>{t("Get your token")}</li>
        <li className={step === 3 ? "now" : ""}><i>3</i>{t("Go when called")}</li>
      </ol>

      {mine && mineService && (
        <div className={`status ${mine.status === "called" ? "go" : mine.status === "waiting" && ahead <= mine.alertAhead ? "soon" : ""}`} role="status" aria-live="polite" style={{ marginTop: 18 }}>
          <div>
            {mine.status === "called" && <><div className="big">{t("It’s your turn! Go to {counter}.", { counter: mineService.counter })}</div><p>Please head to the counter now with token {mine.token}.</p></>}
            {mine.status === "waiting" && <><div className="big">{ahead === 0 ? t("You’re next!") : t("{n} ahead of you", { n: ahead })}</div><p>About {formatMinutes(eta)} to go, around {formatTime(now + eta * 1000)}. Stay nearby.</p>{paused[mine.serviceId] && <p><b>This counter is on a short break. Your place is safe.</b></p>}</>}
            {mine.status === "done" && <><div className="big">{t("All done. Thank you!")}</div><p>How was your visit?</p><div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} className={(mine.rating ?? 0) >= n ? "on" : ""} onClick={() => rate(mine.id, n)}>★</button>)}</div></>}
            {mine.status === "skipped" && <><div className="big">We called you but you weren’t there.</div><p>Start a new visit to get a fresh token.</p></>}
            {mine.status === "cancelled" && <><div className="big">You left the line.</div><p>Start a new visit any time.</p></>}
          </div>
          <div className="tokbig">{mine.token}</div>
        </div>
      )}

      <div className="g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card" aria-label="Join a line">
          {holding ? (
            <>
              <h2>You’re in the {mineService?.name} line</h2>
              <p className="muted">{mineService?.blurb}. Go to {mineService?.counter}.</p>
              <div className="est">
                <div><b>{currentCalled(tickets, mine!.serviceId)?.token ?? "–"}</b><span>Now serving</span></div>
                <div style={{ textAlign: "right" }}><b>{waitingTickets(tickets, mine!.serviceId).length}</b><span>Waiting</span></div>
              </div>
              <p className="hint">Want a different service? Leave this line first.</p>
              {mine?.status === "waiting" && (
                <ConfirmButton className="btn d" onConfirm={() => cancel(mine.id)}>{t("Leave the line")}</ConfirmButton>
              )}
            </>
          ) : (
            <>
              <p className="stepno"><i>1</i>{t("What do you need help with?")}</p>
              <div className="svcs" role="radiogroup" aria-label="Choose a service">
                {SERVICES.map((s) => {
                  const n = waitingTickets(tickets, s.id).length;
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={s.id === selected} className={`svc ${s.id === selected ? "on" : ""}`} onClick={() => setSelected(s.id)}>
                      <span className="l"><i className="pfx">{s.prefix}</i><span><b>{s.name}</b>{s.blurb}</span></span>
                      <span className="w"><b>~{formatMinutes(joinEtaSeconds(tickets, s, now, false))}</b>{paused[s.id] ? "On a short break" : `${n} waiting`}</span>
                    </button>
                  );
                })}
              </div>

              {service && (
                <form onSubmit={(e) => { e.preventDefault(); join(service.id, name, { priority, alertAhead, phone }); setName(""); setPhone(""); }}>
                  <p className="stepno" style={{ marginTop: 20 }}><i>2</i>{t("Your details")}</p>
                  <label htmlFor="nm">{t("Your name")} <span className="muted">{t("(optional)")}</span></label>
                  <input id="nm" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan Miller" autoComplete="name" />
                  <label htmlFor="ph">{t("Mobile number")} <span className="muted">{t("(optional)")}</span></label>
                  <input id="ph" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="For WhatsApp or SMS alerts" autoComplete="tel" />
                  <label htmlFor="al">Alert me when this many people are ahead</label>
                  <select id="al" value={alertAhead} onChange={(e) => setAlertAhead(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 2 ? " (recommended)" : ""}</option>)}
                  </select>
                  <label className="chk"><input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} />I need priority (senior citizen or accessibility need)</label>
                  <p className="hint">Estimated wait for {service.name}: about {formatMinutes(joinEtaSeconds(tickets, service, now, priority))}.</p>
                  <button type="submit" className="btn p">{t("Get my token for {service}", { service: service.name })}</button>
                </form>
              )}
              {!service && <p className="hint" style={{ marginTop: 14 }}>Tap a service above to continue.</p>}
              {perm === "default" && <button type="button" className="btn" onClick={enableAlerts}>Turn on phone alerts</button>}
              {perm === "denied" && <p className="hint">Phone alerts are blocked in your browser. You’ll still see alerts on this page.</p>}
            </>
          )}
        </section>

        {mine ? (
          <div>
            <div className="ticket">
              <small>QueueEase token · {mineService?.name}</small>
              <div className="tokrow">
                <div className="tok">{mine.token}</div>
                {mine.priority && <span className="tag g">Priority</span>}
              </div>
              <div className="two">
                <div><small>Your place</small><b>{statusLabel}</b></div>
                <div><small>Wait left</small><b>{mine.status === "waiting" ? formatDuration(eta) : "–"}</b></div>
              </div>
              {(mine.status === "waiting" || mine.status === "called") && <div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>}
              <div className="barcode" aria-hidden="true" />
            </div>
            {mine.status === "waiting" && <p className="hint">We’ll alert you when {mine.alertAhead} {mine.alertAhead === 1 ? "person is" : "people are"} ahead, and again when it’s your turn.</p>}
            {!holding && <button type="button" className="btn p" onClick={clearMyTicket}>{t("Start a new visit")}</button>}
          </div>
        ) : (
          <div className="card empty"><h2>Your token will appear here</h2><p className="muted">Choose a service on the left to get started.</p></div>
        )}
      </div>

      <details className="help">
        <summary>{t("Need help?")}</summary>
        <ul>
          <li>Keep this page open. You’ll hear a chime and see an alert when it’s almost your turn.</li>
          <li>Wait times are estimates based on recent visits and can change.</li>
          <li>Priority is for seniors and people with accessibility needs.</li>
          <li>Staff? Open the <a href="#staff">Staff desk</a>. Want to watch the line? Open the <a href="#board">Live board</a>.</li>
        </ul>
      </details>
    </>
  );
}

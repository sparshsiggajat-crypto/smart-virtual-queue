import { useEffect, useState } from "react";
import { ConfirmButton } from "./components/ConfirmButton.tsx";
import { NoticeBar } from "./components/NoticeBar.tsx";
import { VENUE, VENUES, VENUE_KEY } from "./data/services.ts";
import { LANG, LANGS, t } from "./lib/i18n.ts";
import { local, session } from "./lib/safeStorage.ts";
import { TurnAlerts } from "./components/TurnAlerts.tsx";
import { QueueProvider, useQueue } from "./store/queueStore.tsx";
import { AnalyticsView } from "./views/AnalyticsView.tsx";
import { BoardView } from "./views/BoardView.tsx";
import { CustomerView } from "./views/CustomerView.tsx";
import { HeadView } from "./views/HeadView.tsx";
import { HostView } from "./views/HostView.tsx";
import { SimulationView } from "./views/SimulationView.tsx";
import { StaffView } from "./views/StaffView.tsx";

const TABS = [
  ["customer", "Get a token"], ["host", "Front desk"], ["staff", "Staff desk"], ["board", "Live board"],
  ["head", "Control room"], ["analytics", "Reports"], ["simulation", "Simulator"],
] as const;
type View = (typeof TABS)[number][0];

const ROLES = {
  customer: ["customer", "board"],
  host: ["host", "staff", "board"],
  head: ["head", "analytics", "simulation", "staff", "board"],
} as const;
type Role = keyof typeof ROLES;
const ROLE_LABEL: Record<Role, string> = { customer: "Customer", host: "Host", head: "Head" };
// Demo PINs. Change these before using the app for real.
const PINS: Record<Role, string> = { customer: "", host: "1111", head: "1234" };

const ICON: Record<View, string> = { customer: "🎟️", host: "🧑‍💼", staff: "🖥️", board: "📺", head: "🛡️", analytics: "📊", simulation: "🧪" };

const HINTS: Record<View, string> = {
  customer: "Pick a service, get a token, then go about your day. We’ll alert you.",
  host: "Add people who walk in without a phone, then call them in order.",
  board: "See who is being called and how long the line is.",
  staff: "Call the next person and finish each visit.",
  head: "Share the join QR, pause counters and download records.",
  analytics: "Wait times, arrivals and a searchable list of tokens.",
  simulation: "Test how many counters a busy day needs.",
};

function viewFromHash(role: Role): View {
  const h = window.location.hash.slice(1);
  const allowed = ROLES[role] as readonly string[];
  return (allowed.includes(h) ? h : allowed[0]) as View;
}

function Shell() {
  const { reset, auto, setAuto, shared } = useQueue();
  const [role, setRole] = useState<Role>(() => { const r = session.getItem("svq-role"); return r === "host" || r === "head" ? r : "customer"; });
  const [view, setView] = useState<View>(() => viewFromHash(role));
  const [unlocked, setUnlocked] = useState(() => session.getItem("svq-unlocked") ?? "");
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const open = role === "customer" || unlocked.split(",").includes(role);
  const allowed = ROLES[role] as readonly string[];

  useEffect(() => {
    const onHash = () => setView(viewFromHash(role));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [role]);

  const switchRole = (r: Role) => {
    setRole(r); session.setItem("svq-role", r); setPin(""); setBad(false);
    window.location.hash = ROLES[r][0]; setView(ROLES[r][0]);
  };
  const submitPin = () => {
    if (pin === PINS[role]) {
      const u = [...unlocked.split(",").filter(Boolean), role].join(",");
      setUnlocked(u); session.setItem("svq-unlocked", u); setBad(false);
    } else setBad(true);
    setPin("");
  };

  return (
    <>
      <header className="top">
        <div className="logo"><i>Q</i>QueueEase <span className="live">Live</span></div>
        <nav aria-label="Sections">
          {TABS.filter(([id]) => allowed.includes(id)).map(([id, text]) => (
            <a key={id} href={`#${id}`} className={view === id ? "on" : ""} aria-current={view === id ? "page" : undefined}><span className="ico" aria-hidden="true">{ICON[id]}</span><span>{t(text)}</span></a>
          ))}
        </nav>
        <div className="who"><b>{VENUE.name}</b>{VENUE.place}</div>
      </header>
      <div className="sub">
        <div className="seg" role="group" aria-label="I am a">
          {(Object.keys(ROLES) as Role[]).map((r) => <button key={r} type="button" className={role === r ? "on" : ""} onClick={() => switchRole(r)}>{t(ROLE_LABEL[r])}</button>)}
        </div>
        <span className="muted">{HINTS[view]}</span>
        <label className="venue">
          <select value={LANG} aria-label="Language" onChange={(e) => { local.setItem("svq-lang", e.target.value); window.location.reload(); }}>
            {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {role === "head" && (
          <label className="venue">Type of place
            <select value={VENUE_KEY} aria-label="Type of place" onChange={(e) => { local.setItem("svq-venue", e.target.value); local.removeItem("svq-my-ticket"); window.location.reload(); }}>
              {Object.entries(VENUES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </label>
        )}
        <details className="demo">
          <summary>Demo tools</summary>
          <div className="demopanel">
            <label className="chk" style={{ margin: 0 }}>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Auto-play: staff serve people and walk-ins arrive
            </label>
            <p className="muted">Turn this on in one browser tab only.</p>
            <ConfirmButton className="btn s" onConfirm={reset}>Reset demo</ConfirmButton>
          </div>
        </details>
      </div>
      <main>
        <NoticeBar />
        {!open ? (
          <form className="card pin" onSubmit={(e) => { e.preventDefault(); submitPin(); }}>
            <h2>{t(ROLE_LABEL[role])} sign in</h2>
            <p className="muted">Enter your PIN to open this console. Demo PIN: {PINS[role]}</p>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} aria-label="PIN" autoFocus />
            {bad && <p className="hint" style={{ color: "var(--err)" }}>That PIN is not right. Try again.</p>}
            <button type="submit" className="btn p">Open {ROLE_LABEL[role]} console</button>
          </form>
        ) : (
          <>
            {view === "customer" && <CustomerView />}
            {view === "host" && <HostView />}
            {view === "board" && <BoardView />}
            {view === "staff" && <StaffView />}
            {view === "head" && <HeadView />}
            {view === "analytics" && <AnalyticsView />}
            {view === "simulation" && <SimulationView />}
          </>
        )}
      </main>
      <p className="foot">{shared ? "Live: one queue shared by every device connected to this server." : "Demo mode: this queue is saved in this browser only. Run the server (npm start) to share it across devices."}</p>
      <TurnAlerts />
    </>
  );
}

export default function App() {
  return (
    <QueueProvider>
      <Shell />
    </QueueProvider>
  );
}

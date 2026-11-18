import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { local, session } from "../lib/safeStorage.ts";
import { SERVICES, VENUE_KEY, serviceById, type Service, type ServiceId } from "../data/services.ts";

export type TicketStatus = "waiting" | "called" | "done" | "skipped" | "cancelled";

export type Ticket = {
  id: string;
  token: string;
  serviceId: ServiceId;
  name: string;
  joinedAt: number;
  status: TicketStatus;
  calledAt?: number;
  finishedAt?: number;
  recallCount: number;
  priority: boolean;
  alertAhead: number;
  rating?: number;
  phone?: string;
};

type Persisted = { tickets: Ticket[]; sequences: Record<ServiceId, number>; notice?: string; paused?: Record<string, boolean> };

type JoinOptions = { priority?: boolean; alertAhead?: number; phone?: string };

type QueueContextValue = {
  tickets: Ticket[];
  now: number;
  myTicketId: string | null;
  auto: boolean;
  notice: string;
  paused: Record<string, boolean>;
  setNotice: (text: string) => void;
  togglePause: (id: ServiceId) => void;
  rate: (ticketId: string, n: number) => void;
  shared: boolean;
  walkIn: (serviceId: ServiceId, name: string, options?: JoinOptions) => string;
  setAuto: (on: boolean) => void;
  join: (serviceId: ServiceId, name: string, options?: JoinOptions) => void;
  cancel: (ticketId: string) => void;
  callNext: (serviceId: ServiceId) => void;
  recall: (serviceId: ServiceId) => void;
  markServed: (serviceId: ServiceId) => void;
  skip: (serviceId: ServiceId) => void;
  reset: () => void;
  clearMyTicket: () => void;
};

const STORAGE_KEY = `svq-state-v3-${VENUE_KEY}`;
const MY_TICKET_KEY = "svq-my-ticket";
const AUTO_KEY = "svq-auto";
const NAMES = ["Imani Cole", "Noah Grant", "Maya Chen", "Jonah Hale", "Priya Shah", "Greta Holm", "Sofia Marin", "Luis Ortega", "Owen Blake", "Leila Mensah", "Chris Adeyemi", "Elena Voss", "Asha Rao", "Ravi Nair", "Meera Das", "Karan Shah"];

const QueueContext = createContext<QueueContextValue | null>(null);

function token(service: Service, n: number) {
  return `${service.prefix}-${String(n).padStart(3, "0")}`;
}

export function createSeed(now = Date.now()): Persisted {
  const tickets: Ticket[] = [];
  const sequences = {} as Record<ServiceId, number>;
  SERVICES.forEach((service, si) => {
    let n = 0;
    const mk = (status: TicketStatus, joinedMin: number, extra: Partial<Ticket> = {}) => {
      n += 1;
      tickets.push({
        id: `seed-${service.id}-${n}`,
        token: token(service, n),
        serviceId: service.id,
        name: NAMES[(si * 4 + n) % NAMES.length],
        joinedAt: now - joinedMin * 60_000,
        status,
        recallCount: 0,
        priority: false,
        alertAhead: 2,
        ...extra,
      });
    };
    for (let k = 0; k < 6; k++) {
      const joined = 76 - k * 9 - si * 2;
      const wait = 3 + ((k * 7 + si * 3) % 9);
      const dur = service.avgServiceSec * (0.7 + ((k * 5 + si) % 6) / 10);
      const calledAt = now - (joined - wait) * 60_000;
      mk("done", joined, { calledAt, finishedAt: calledAt + dur * 1000 });
    }
    mk("called", 9, { calledAt: now - 30_000 * (si + 1) });
    mk("waiting", 7);
    mk("waiting", 4, { priority: si === 1 });
    mk("waiting", 2);
    sequences[service.id] = n;
  });
  return { tickets, sequences };
}

function safeParse(raw: string): Persisted | null {
  try {
    const data = JSON.parse(raw) as Persisted;
    if (!data || !Array.isArray(data.tickets) || !data.sequences) return null;
    if (!SERVICES.every((s) => typeof data.sequences[s.id] === "number")) return null;
    return data;
  } catch {
    return null;
  }
}

function loadState(): Persisted {
  const raw = local.getItem(STORAGE_KEY);
  return (raw && safeParse(raw)) || createSeed();
}

export function currentCalled(tickets: Ticket[], serviceId: ServiceId) {
  return tickets.find((t) => t.serviceId === serviceId && t.status === "called");
}

export function waitingTickets(tickets: Ticket[], serviceId: ServiceId): Ticket[] {
  return tickets
    .filter((t) => t.serviceId === serviceId && t.status === "waiting")
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.joinedAt - b.joinedAt);
}

/** Average service time, learned from recent completed tickets and blended with the default. */
export function avgServiceSec(tickets: Ticket[], service: Service): number {
  const recent = tickets
    .filter((t) => t.serviceId === service.id && t.status === "done" && t.calledAt && t.finishedAt)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 6)
    .map((t) => ((t.finishedAt ?? 0) - (t.calledAt ?? 0)) / 1000);
  const sum = recent.reduce((a, b) => a + b, 0);
  return Math.max(20, (sum + service.avgServiceSec * 2) / (recent.length + 2));
}

export function peopleAhead(ticket: Ticket, tickets: Ticket[]): number {
  if (ticket.status !== "waiting") return 0;
  const idx = waitingTickets(tickets, ticket.serviceId).findIndex((t) => t.id === ticket.id);
  return Math.max(0, idx) + (currentCalled(tickets, ticket.serviceId) ? 1 : 0);
}

function etaForPosition(position: number, tickets: Ticket[], service: Service, now: number): number {
  const avg = avgServiceSec(tickets, service);
  const current = currentCalled(tickets, service.id);
  let seconds = position * avg;
  if (current) seconds += Math.max(0, avg - (now - (current.calledAt ?? now)) / 1000);
  return Math.round(seconds);
}

export function etaSeconds(ticket: Ticket, tickets: Ticket[], service: Service, now: number): number {
  if (ticket.status !== "waiting") return 0;
  const idx = waitingTickets(tickets, ticket.serviceId).findIndex((t) => t.id === ticket.id);
  return etaForPosition(Math.max(0, idx), tickets, service, now);
}

/** Estimated wait for someone who joins now. */
export function joinEtaSeconds(tickets: Ticket[], service: Service, now: number, priority: boolean): number {
  const line = waitingTickets(tickets, service.id);
  const position = priority ? line.filter((t) => t.priority).length : line.length;
  return etaForPosition(position, tickets, service, now);
}

function hash(text: string) {
  return [...text].reduce((a, c) => a + c.charCodeAt(0) * 31, 0);
}

function addTicket(prev: Persisted, service: Service, name: string, now: number, options: JoinOptions = {}, id: string = crypto.randomUUID()): Persisted {
  const number = prev.sequences[service.id] + 1;
  const t: Ticket = {
    id,
    token: token(service, number),
    serviceId: service.id,
    name,
    joinedAt: now,
    status: "waiting",
    recallCount: 0,
    priority: options.priority ?? false,
    alertAhead: options.alertAhead ?? 2,
    phone: options.phone?.trim() || undefined,
  };
  return { ...prev, sequences: { ...prev.sequences, [service.id]: number }, tickets: [...prev.tickets, t] };
}

/** Demo staff: finishes and calls tickets, and adds walk-ins. */
function simulate(prev: Persisted, now: number): Persisted {
  let state = prev;
  for (const service of SERVICES) {
    const current = currentCalled(state.tickets, service.id);
    if (current && now - (current.calledAt ?? now) > 8000 + (hash(current.id) % 14000)) {
      const status: TicketStatus = hash(current.id) % 17 === 0 ? "skipped" : "done";
      state = { ...state, tickets: state.tickets.map((t) => (t.id === current.id ? { ...t, status, finishedAt: now } : t)) };
    }
    if (!currentCalled(state.tickets, service.id) && !state.paused?.[service.id]) {
      const next = waitingTickets(state.tickets, service.id)[0];
      if (next) state = { ...state, tickets: state.tickets.map((t) => (t.id === next.id ? { ...t, status: "called", calledAt: now } : t)) };
    }
    if (Math.random() < 0.2 && waitingTickets(state.tickets, service.id).length < 9) {
      state = addTicket(state, service, NAMES[Math.floor(Math.random() * NAMES.length)], now, { priority: Math.random() < 0.1 });
    }
  }
  return state;
}

export function QueueProvider({ children }: { children: ReactNode }) {
  const [state, setLocal] = useState<Persisted>(loadState);
  const [shared, setShared] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const srv = useRef({ on: false, rev: 0, base: null as Persisted | null, pending: 0, chain: Promise.resolve() });

  // All changes go through here. With a server, each change is applied on the latest shared state
  // and retried if someone else changed the queue first, so simultaneous actions are never lost.
  const setState = (u: Persisted | ((p: Persisted) => Persisted)) => {
    const fn = typeof u === "function" ? u : () => u;
    setLocal(fn);
    const s = srv.current;
    if (!s.on) return;
    s.pending += 1;
    s.chain = s.chain.then(async () => {
      try {
        for (let i = 0; i < 6; i++) {
          const next = fn(s.base ?? stateRef.current);
          const r = await fetch(`/api/state?v=${VENUE_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rev: s.rev, state: next }) });
          const d = await r.json();
          if (r.ok) { s.rev = d.rev; s.base = next; break; }
          if (r.status === 409 && d.state) { s.rev = d.rev; s.base = d.state; } else break;
        }
      } catch { /* server unreachable: keep working locally */ }
      s.pending -= 1;
      if (s.pending === 0 && s.base) setLocal(s.base);
    });
  };

  useEffect(() => {
    let es: EventSource | undefined;
    let dead = false;
    const apply = (d: { rev: number; state: Persisted | null }) => {
      const s = srv.current;
      if (!d.state || !safeParse(JSON.stringify(d.state)) || d.rev < s.rev) return;
      s.rev = d.rev; s.base = d.state;
      if (s.pending === 0) setLocal(d.state);
    };
    fetch(`/api/state?v=${VENUE_KEY}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (dead || typeof d?.rev !== "number") return;
        srv.current.on = true;
        srv.current.rev = d.rev;
        setShared(true);
        if (d.state) apply(d); else setState(() => stateRef.current); // first run: seed the server
        es = new EventSource(`/api/events?v=${VENUE_KEY}`);
        es.onmessage = (e) => apply(JSON.parse(e.data));
      })
      .catch(() => { /* no server: browser-only demo mode */ });
    return () => { dead = true; es?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [now, setNow] = useState(() => Date.now());
  const [auto, setAutoState] = useState(() => local.getItem(AUTO_KEY) === "1");
  const [myTicketId, setMyTicketId] = useState<string | null>(() => local.getItem(MY_TICKET_KEY));
  const joinLock = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    local.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        const parsed = safeParse(event.newValue);
        if (parsed && !srv.current.on) setLocal(parsed);
      }
      if (event.key === AUTO_KEY) setAutoState(event.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setState((prev) => simulate(prev, Date.now())), 3000);
    return () => window.clearInterval(id);
  }, [auto]);

  const setAuto = (on: boolean) => {
    setAutoState(on);
    local.setItem(AUTO_KEY, on ? "1" : "0");
  };

  const rememberTicket = (id: string | null) => {
    setMyTicketId(id);
    if (id) local.setItem(MY_TICKET_KEY, id);
    else local.removeItem(MY_TICKET_KEY);
  };

  const active = state.tickets.find((t) => t.id === myTicketId);
  const holding = Boolean(active && (active.status === "waiting" || active.status === "called"));
  useEffect(() => {
    if (!holding) joinLock.current = false;
  }, [holding]);

  const patch = (fn: (t: Ticket) => Ticket, match: (t: Ticket) => boolean) =>
    setState((prev) => ({ ...prev, tickets: prev.tickets.map((t) => (match(t) ? fn(t) : t)) }));

  const finish = (serviceId: ServiceId, status: "done" | "skipped") =>
    setState((prev) => {
      const current = currentCalled(prev.tickets, serviceId);
      if (!current) return prev;
      return { ...prev, tickets: prev.tickets.map((t) => (t.id === current.id ? { ...t, status, finishedAt: Date.now() } : t)) };
    });

  const value: QueueContextValue = {
    tickets: state.tickets,
    now,
    myTicketId,
    auto,
    setAuto,
    shared,
    notice: state.notice ?? "",
    paused: state.paused ?? {},
    setNotice: (text) => setState((p) => ({ ...p, notice: text.slice(0, 140) })),
    togglePause: (id) => setState((p) => ({ ...p, paused: { ...p.paused, [id]: !p.paused?.[id] } })),
    rate: (id, n) => patch((t) => ({ ...t, rating: n }), (t) => t.id === id),
    walkIn: (serviceId, rawName, options) => {
      const service = serviceById(serviceId);
      const tk = token(service, state.sequences[serviceId] + 1);
      setState((prev) => addTicket(prev, service, rawName.trim() || "Walk-in", Date.now(), options));
      return tk;
    },
    join: (serviceId, rawName, options) => {
      if (joinLock.current || holding) return;
      joinLock.current = true;
      const id = crypto.randomUUID();
      const service = serviceById(serviceId);
      setState((prev) => addTicket(prev, service, rawName.trim() || "Guest", Date.now(), options, id));
      rememberTicket(id);
    },
    cancel: (id) => patch((t) => ({ ...t, status: "cancelled", finishedAt: Date.now() }), (t) => t.id === id && t.status === "waiting"),
    callNext: (serviceId) =>
      setState((prev) => {
        if (currentCalled(prev.tickets, serviceId) || prev.paused?.[serviceId]) return prev;
        const next = waitingTickets(prev.tickets, serviceId)[0];
        if (!next) return prev;
        return { ...prev, tickets: prev.tickets.map((t) => (t.id === next.id ? { ...t, status: "called", calledAt: Date.now() } : t)) };
      }),
    recall: (serviceId) =>
      setState((prev) => {
        const current = currentCalled(prev.tickets, serviceId);
        if (!current) return prev;
        return { ...prev, tickets: prev.tickets.map((t) => (t.id === current.id ? { ...t, recallCount: t.recallCount + 1 } : t)) };
      }),
    markServed: (serviceId) => finish(serviceId, "done"),
    skip: (serviceId) => finish(serviceId, "skipped"),
    reset: () => {
      setState(createSeed());
      rememberTicket(null);
      session.removeItem("svq-seen-alerts");
    },
    clearMyTicket: () => rememberTicket(null),
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueContextValue {
  const context = useContext(QueueContext);
  if (!context) throw new Error("useQueue must be used within QueueProvider");
  return context;
}

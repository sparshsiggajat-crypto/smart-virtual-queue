export type Params = {
  arrivalsPerHour: number;
  counters: number;
  serviceMin: number;
  patienceMin: number;
  priorityPct: number;
};

export type SimTicket = { id: number; arrived: number; priority: boolean; patience: number; service: number };
export type Desk = { ticket: SimTicket | null; endsAt: number };

export type Sim = {
  t: number;
  nextId: number;
  queue: SimTicket[];
  desks: Desk[];
  served: number;
  abandoned: number;
  waitSum: number;
  maxWait: number;
  within: number;
  maxQueue: number;
  busyAcc: number;
  capAcc: number;
  history: number[];
  rng: () => number;
};

export const SLA_MIN = 10;
const STEP = 1 / 6; // one step is 10 simulated seconds

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(counters: number, seed = Date.now()): Sim {
  return {
    t: 0, nextId: 1, queue: [], desks: Array.from({ length: counters }, () => ({ ticket: null, endsAt: 0 })),
    served: 0, abandoned: 0, waitSum: 0, maxWait: 0, within: 0, maxQueue: 0, busyAcc: 0, capAcc: 0, history: [], rng: mulberry(seed),
  };
}

function syncDesks(s: Sim, n: number) {
  while (s.desks.length < n) s.desks.push({ ticket: null, endsAt: 0 });
  while (s.desks.length > n) {
    const i = s.desks.map((d) => d.ticket).lastIndexOf(null);
    if (i < 0) break; // only free desks can close
    s.desks.splice(i, 1);
  }
}

export function step(s: Sim, p: Params) {
  syncDesks(s, p.counters);
  const before = Math.floor(s.t);
  s.t += STEP;

  if (s.rng() < (p.arrivalsPerHour / 3600) * 10) {
    const service = Math.min(3 * p.serviceMin, Math.max(0.3 * p.serviceMin, -Math.log(1 - s.rng()) * p.serviceMin));
    s.queue.push({ id: s.nextId++, arrived: s.t, priority: s.rng() < p.priorityPct / 100, patience: p.patienceMin * (0.5 + s.rng()), service });
  }

  const stay: SimTicket[] = [];
  for (const q of s.queue) (s.t - q.arrived > q.patience ? (s.abandoned += 1) : stay.push(q));
  s.queue = stay;

  for (const d of s.desks) {
    if (d.ticket && s.t >= d.endsAt) {
      s.served += 1;
      d.ticket = null;
    }
    if (!d.ticket && s.queue.length) {
      const i = Math.max(0, s.queue.findIndex((q) => q.priority));
      const [next] = s.queue.splice(i, 1);
      const wait = s.t - next.arrived;
      s.waitSum += wait;
      s.maxWait = Math.max(s.maxWait, wait);
      if (wait <= SLA_MIN) s.within += 1;
      d.ticket = next;
      d.endsAt = s.t + next.service;
    }
  }

  s.busyAcc += s.desks.filter((d) => d.ticket).length * STEP;
  s.capAcc += s.desks.length * STEP;
  s.maxQueue = Math.max(s.maxQueue, s.queue.length);
  if (Math.floor(s.t) !== before) s.history.push(s.queue.length);
}

export function summary(s: Sim) {
  const called = s.served + s.desks.filter((d) => d.ticket).length; // everyone who reached a counter
  return {
    served: s.served,
    abandoned: s.abandoned,
    avgWait: called ? s.waitSum / called : 0,
    maxWait: s.maxWait,
    slaPct: called ? (100 * s.within) / called : 100,
    util: s.capAcc ? (100 * s.busyAcc) / s.capAcc : 0,
    maxQueue: s.maxQueue,
  };
}

export function runDay(p: Params, hours = 8, seed = 7) {
  const s = createSim(p.counters, seed);
  for (let i = 0; i < hours * 360; i++) step(s, p);
  return summary(s);
}

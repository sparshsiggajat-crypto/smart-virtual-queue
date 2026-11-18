import { useEffect, useMemo, useRef, useState } from "react";
import { AreaChart } from "../components/Charts.tsx";
import { SLA_MIN, createSim, runDay, step, summary, type Params } from "../lib/simulation.ts";

const SPEEDS = [1, 5, 20, 60] as const;
const DEFAULTS: Params = { arrivalsPerHour: 60, counters: 3, serviceMin: 4, patienceMin: 25, priorityPct: 10 };

function clock(t: number) {
  const total = 540 + Math.floor(t);
  const h = Math.floor(total / 60) % 24;
  return `${h % 12 || 12}:${String(total % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

type SliderProps = { id: string; label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void };
function Slider({ id, label, value, min, max, step: st = 1, unit, onChange }: SliderProps) {
  return (
    <div>
      <label htmlFor={id}>{label}: <b>{value} {unit}</b></label>
      <input id={id} type="range" min={min} max={max} step={st} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ padding: 0 }} />
    </div>
  );
}

export function SimulationView() {
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(5);
  const [, setFrame] = useState(0);
  const sim = useRef(createSim(DEFAULTS.counters));
  const live = useRef(params);
  const carry = useRef(0);
  live.current = params;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      carry.current += speed * 0.2 * 6; // steps of 10 simulated seconds
      const n = Math.floor(carry.current);
      carry.current -= n;
      for (let i = 0; i < n; i++) step(sim.current, live.current);
      setFrame((f) => f + 1);
    }, 200);
    return () => window.clearInterval(id);
  }, [running, speed]);

  const set = <K extends keyof Params>(k: K) => (v: number) => setParams((p) => ({ ...p, [k]: v }));
  const reset = () => { sim.current = createSim(params.counters); carry.current = 0; setRunning(false); setFrame((f) => f + 1); };
  const skip = (minutes: number) => { for (let i = 0; i < minutes * 6; i++) step(sim.current, params); setFrame((f) => f + 1); };

  const s = sim.current;
  const sum = summary(s);
  const { arrivalsPerHour, serviceMin, patienceMin, priorityPct } = params;
  const whatIf = useMemo(
    () => Array.from({ length: 8 }, (_, i) => ({ n: i + 1, ...runDay({ arrivalsPerHour, serviceMin, patienceMin, priorityPct, counters: i + 1 }) })),
    [arrivalsPerHour, serviceMin, patienceMin, priorityPct],
  );
  const best = whatIf.find((r) => r.slaPct >= 90 && r.avgWait <= SLA_MIN);

  return (
    <>
      <h1>Queue simulation</h1>
      <p className="muted">Test how many counters you need. Change anything while it runs and watch the line react.</p>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <div className="row">
            <button type="button" className="btn p s" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : s.t > 0 ? "Resume" : "Start"}</button>
            <button type="button" className="btn s" onClick={reset}>Reset</button>
            <button type="button" className="btn s" onClick={() => skip(60)}>Skip 1 hour</button>
          </div>
          <div className="seg" role="group" aria-label="Speed">
            {SPEEDS.map((v) => <button key={v} type="button" className={speed === v ? "on" : ""} onClick={() => setSpeed(v)}>{v} min/s</button>)}
          </div>
        </div>
        <div className="g3b">
          <Slider id="ar" label="Arrivals" value={arrivalsPerHour} min={10} max={150} step={5} unit="per hour" onChange={set("arrivalsPerHour")} />
          <Slider id="ct" label="Counters" value={params.counters} min={1} max={8} unit="open" onChange={set("counters")} />
          <Slider id="sv" label="Service time" value={serviceMin} min={1} max={15} unit="min avg" onChange={set("serviceMin")} />
          <Slider id="pt" label="Patience" value={patienceMin} min={5} max={60} step={5} unit="min avg" onChange={set("patienceMin")} />
          <Slider id="pr" label="Priority customers" value={priorityPct} min={0} max={40} step={5} unit="%" onChange={set("priorityPct")} />
        </div>
      </div>

      <div className="g4">
        {[
          ["Simulated time", clock(s.t), running ? "Running" : "Paused"],
          ["In line now", String(s.queue.length), `Peak ${s.maxQueue}`],
          ["Average wait", `${sum.avgWait.toFixed(1)} min`, `Longest ${sum.maxWait.toFixed(1)} min`],
          ["Served", String(sum.served), `${s.abandoned} gave up waiting`],
          ["Within target", `${sum.slaPct.toFixed(0)}%`, `Target ${SLA_MIN} min wait`],
          ["Counter use", `${sum.util.toFixed(0)}%`, "Time spent serving"],
        ].map(([k, v, n]) => <div className="card kpi" key={k}><small>{k}</small><b>{v}</b><span className="muted">{n}</span></div>)}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Counters</h2>
        <div className="wins">
          {s.desks.map((d, i) => (
            <div className="win" key={i}>
              <div className="row"><span className="tag">Counter {i + 1}</span>{d.ticket ? <span className="tag g">Serving</span> : <span className="tag b">Free</span>}</div>
              <div className="srv">{d.ticket ? "Token" : "Ready"}<b>{d.ticket ? `S-${String(d.ticket.id).padStart(3, "0")}` : "–"}</b>
                {d.ticket ? `${Math.max(0, d.endsAt - s.t).toFixed(1)} min left` : "Waiting for next"}</div>
            </div>
          ))}
        </div>
        <h2 style={{ marginTop: 14 }}>Line</h2>
        <div className="belt" style={{ paddingTop: 12 }}>
          {s.queue.length === 0 && <div className="empty" style={{ width: "100%" }}>No one waiting.</div>}
          {s.queue.slice(0, 14).map((q) => (
            <div className={q.priority ? "tk f" : "tk"} key={q.id}>S-{String(q.id).padStart(3, "0")}<small>{(s.t - q.arrived).toFixed(0)}m</small></div>
          ))}
          {s.queue.length > 14 && <div className="muted" style={{ flex: "none" }}>+{s.queue.length - 14} more</div>}
        </div>
      </div>

      <div className="g2" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <div className="card"><h2>People in line over time</h2><p className="muted">One point per simulated minute.</p><AreaChart values={s.history} label="Queue length over time" /></div>
        <div className="card">
          <h2>How many counters do I need?</h2>
          <p className="muted">An 8 hour day at your current settings.</p>
          <p style={{ fontWeight: 700 }}>{best ? `Open ${best.n} ${best.n === 1 ? "counter" : "counters"} to keep waits under ${SLA_MIN} minutes for 90% of people.` : "Even 8 counters miss the target. Shorten service time or add staff channels."}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Counter comparison</h2>
        <div className="tw">
          <table>
            <thead><tr><th>Counters</th><th>Average wait</th><th>Within target</th><th>Gave up</th><th>Counter use</th><th>Result</th></tr></thead>
            <tbody>
              {whatIf.map((r) => (
                <tr key={r.n} style={r.n === params.counters ? { background: "var(--low)" } : undefined}>
                  <td><b>{r.n}</b></td><td>{r.avgWait.toFixed(1)} min</td><td>{r.slaPct.toFixed(0)}%</td><td>{r.abandoned}</td><td>{r.util.toFixed(0)}%</td>
                  <td><span className={`tag ${r.slaPct >= 90 && r.avgWait <= SLA_MIN ? "g" : r.slaPct >= 70 ? "b" : "r"}`}>{r.slaPct >= 90 && r.avgWait <= SLA_MIN ? "Meets target" : r.slaPct >= 70 ? "Close" : "Too slow"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

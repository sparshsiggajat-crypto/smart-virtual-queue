import { SERVICES, type ServiceId } from "../data/services.ts";
import { useQueue, waitingTickets } from "../store/queueStore.tsx";

export function ServiceTabs({ value, onChange, all }: { value: ServiceId | "all"; onChange: (id: ServiceId | "all") => void; all?: boolean }) {
  const { tickets } = useQueue();
  return (
    <div className="seg" role="tablist" aria-label="Services">
      {all && (
        <button type="button" className={value === "all" ? "on" : ""} onClick={() => onChange("all")}>All services</button>
      )}
      {SERVICES.map((s) => (
        <button key={s.id} type="button" role="tab" aria-selected={value === s.id} className={value === s.id ? "on" : ""} onClick={() => onChange(s.id)}>
          {s.name}
          <em>{waitingTickets(tickets, s.id).length}</em>
        </button>
      ))}
    </div>
  );
}

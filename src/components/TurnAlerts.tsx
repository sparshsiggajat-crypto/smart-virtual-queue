import { useEffect, useState } from "react";
import { session } from "../lib/safeStorage.ts";
import { serviceById } from "../data/services.ts";
import { peopleAhead, useQueue, type Ticket } from "../store/queueStore.tsx";

type Toast = { id: string; title: string; body: string };

const SEEN_KEY = "svq-seen-alerts";

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(session.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio can be blocked until the person interacts with the page.
  }
}

function describe(ticket: Ticket, ahead: number) {
  const service = serviceById(ticket.serviceId);
  if (ticket.status === "called") {
    return {
      key: `turn:${ticket.id}:${ticket.recallCount}`,
      title: ticket.recallCount > 0 ? "Called again" : "It’s your turn",
      body: `${ticket.token}. Go to ${service.counter} now.`,
    };
  }
  if (ticket.status === "waiting" && ahead <= ticket.alertAhead) {
    return {
      key: `near:${ticket.id}`,
      title: ahead === 0 ? "You’re next" : "Your turn is approaching",
      body: ahead === 0 ? `${ticket.token} is at the front of ${service.name}.` : `${ticket.token} has ${ahead} ${ahead === 1 ? "person" : "people"} ahead at ${service.name}.`,
    };
  }
  return null;
}

export function TurnAlerts() {
  const { tickets, myTicketId } = useQueue();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ticket = tickets.find((t) => t.id === myTicketId) ?? null;
  const ahead = ticket ? peopleAhead(ticket, tickets) : 0;
  const next = ticket ? describe(ticket, ahead) : null;
  const key = next?.key ?? "";

  useEffect(() => {
    if (!ticket || !next) return;
    const seen = loadSeen();
    if (seen.has(next.key)) return;
    seen.add(next.key);
    session.setItem(SEEN_KEY, JSON.stringify([...seen]));
    setToasts((cur) => [...cur, { id: next.key, title: next.title, body: next.body }]);
    chime();
    navigator.vibrate?.(ticket.status === "called" ? [200, 100, 200] : 120);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(next.title, { body: next.body });
      } catch {
        // Some browsers reject the constructor without a user gesture.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    document.title = ticket && (ticket.status === "waiting" || ticket.status === "called")
      ? ticket.status === "called" ? `Your turn: ${ticket.token}` : `${ticket.token}: ${ahead} ahead`
      : "QueueEase: Smart Virtual Queue";
  }, [ticket, ahead]);

  useEffect(() => {
    if (!toasts.length) return;
    const id = window.setTimeout(() => setToasts((cur) => cur.slice(1)), 8000);
    return () => window.clearTimeout(id);
  }, [toasts]);

  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className="toast" onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}>
          <strong>{t.title}</strong>
          <span>{t.body}</span>
        </button>
      ))}
    </div>
  );
}

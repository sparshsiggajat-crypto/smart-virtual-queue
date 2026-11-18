import { useEffect, useState, type ReactNode } from "react";

/** Two-tap confirm. Works everywhere (browser pop-ups are blocked in many embedded views). */
export function ConfirmButton({ onConfirm, className, disabled, children }: { onConfirm: () => void; className?: string; disabled?: boolean; children: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? "Tap again to confirm" : children}
    </button>
  );
}

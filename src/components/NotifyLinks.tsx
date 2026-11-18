import { notifyLinks } from "../lib/notify.ts";

export function NotifyLinks({ phone, text }: { phone: string; text: string }) {
  const l = notifyLinks(phone, text);
  return (
    <div className="notify">
      <a className="btn s" href={l.wa} target="_blank" rel="noreferrer">WhatsApp</a>
      <a className="btn s" href={l.sms}>SMS</a>
    </div>
  );
}

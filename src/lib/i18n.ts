import { local } from "./safeStorage.ts";

export const LANGS = { en: "English", hi: "हिन्दी" } as const;
const saved = local.getItem("svq-lang");
export const LANG: keyof typeof LANGS = saved === "hi" ? "hi" : "en";

// Add more languages by adding another table and an entry in LANGS.
const HI: Record<string, string> = {
  "Get a token": "टोकन लें", "Front desk": "फ्रंट डेस्क", "Staff desk": "स्टाफ डेस्क", "Live board": "लाइव बोर्ड",
  "Control room": "कंट्रोल रूम", "Reports": "रिपोर्ट", "Simulator": "सिम्युलेटर",
  "Customer": "ग्राहक", "Host": "होस्ट", "Head": "प्रमुख",
  "Skip the wait. Get a token.": "इंतज़ार छोड़िए। टोकन लीजिए।",
  "No need to stand in line. Get a digital token and we’ll tell you when it’s your turn.": "लाइन में खड़े होने की ज़रूरत नहीं। डिजिटल टोकन लें, आपकी बारी आने पर हम बताएँगे।",
  "Choose a service": "सेवा चुनें", "Get your token": "अपना टोकन लें", "Go when called": "बुलाने पर जाएँ",
  "What do you need help with?": "आपको किस काम में मदद चाहिए?", "Your details": "आपकी जानकारी",
  "Your name": "आपका नाम", "(optional)": "(वैकल्पिक)", "Mobile number": "मोबाइल नंबर",
  "Get my token for {service}": "{service} के लिए मेरा टोकन लें",
  "Leave the line": "लाइन छोड़ें", "Start a new visit": "नया टोकन लें",
  "It’s your turn! Go to {counter}.": "आपकी बारी है! {counter} पर जाएँ।",
  "You’re next!": "आप अगले हैं!", "{n} ahead of you": "आपसे पहले {n} लोग",
  "All done. Thank you!": "काम पूरा हुआ। धन्यवाद!", "Need help?": "मदद चाहिए?",
};

export function t(s: string, v: Record<string, string | number> = {}): string {
  let out = LANG === "hi" ? HI[s] ?? s : s;
  for (const k of Object.keys(v)) out = out.split(`{${k}}`).join(String(v[k]));
  return out;
}

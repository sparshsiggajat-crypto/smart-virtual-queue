/** One-tap WhatsApp and SMS links. Works without a server; the sender taps Send. */
export function notifyLinks(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const wa = digits.length === 10 ? `91${digits}` : digits; // 10 digits is treated as an Indian number
  return { wa: `https://wa.me/${wa}?text=${encodeURIComponent(text)}`, sms: `sms:${digits}?body=${encodeURIComponent(text)}` };
}

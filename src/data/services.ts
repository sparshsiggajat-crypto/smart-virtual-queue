import { local } from "../lib/safeStorage.ts";

export type Service = { id: string; name: string; prefix: string; counter: string; avgServiceSec: number; blurb: string };
export type ServiceId = string;
type Venue = { name: string; place: string; services: Service[] };

const s = (id: string, name: string, prefix: string, counter: string, avgServiceSec: number, blurb: string): Service => ({ id, name, prefix, counter, avgServiceSec, blurb });

export const VENUES: Record<string, Venue> = {
  bank: { name: "Bank", place: "Central Branch", services: [
    s("accounts", "Accounts", "A", "Counter 1", 240, "Balances, cards, and profile changes"),
    s("payments", "Payments", "P", "Counter 2", 180, "Bills, transfers, and receipts"),
    s("documents", "Documents", "D", "Counter 3", 360, "Forms, copies, and certifications"),
    s("support", "Support", "S", "Counter 4", 300, "Questions and account help")] },
  hospital: { name: "Hospital or clinic", place: "City Hospital, OPD", services: [
    s("registration", "Registration", "R", "Desk 1", 180, "Check-in for new and returning patients"),
    s("doctor", "Doctor consultation", "G", "Room 1", 420, "See a general physician"),
    s("lab", "Lab tests", "L", "Lab window", 240, "Blood tests and sample collection"),
    s("pharmacy", "Pharmacy", "M", "Counter 2", 150, "Collect your medicines")] },
  gov: { name: "Government office", place: "District Service Centre", services: [
    s("certs", "Certificates", "C", "Window 1", 420, "Birth, income and residence certificates"),
    s("licence", "Licences and permits", "L", "Window 2", 480, "Driving licence and permit applications"),
    s("bills", "Tax and bills", "T", "Window 3", 240, "Property tax, water and electricity bills"),
    s("help", "Help desk", "H", "Desk 4", 180, "Form help and general questions")] },
  salon: { name: "Salon or shop", place: "Glow Salon", services: [
    s("hair", "Haircut", "H", "Chair 1", 1500, "Cut and styling"),
    s("spa", "Facial and spa", "F", "Room A", 2400, "Skin care and massage"),
    s("billing", "Billing", "B", "Front desk", 120, "Pay and collect your items")] },
  college: { name: "College or campus", place: "Main Administrative Block", services: [
    s("admission", "Admissions", "A", "Window 1", 420, "Enquiries and application forms"),
    s("fees", "Fee payment", "F", "Window 2", 200, "Pay fees and collect receipts"),
    s("exam", "Exam section", "E", "Window 3", 300, "Hall tickets, results and re-checks"),
    s("library", "Library", "L", "Desk 4", 150, "Cards, books and dues")] },
};

const saved = local.getItem("svq-venue") ?? "";
export const VENUE_KEY = Object.keys(VENUES).includes(saved) ? saved : "bank";
export const VENUE = VENUES[VENUE_KEY];
export const SERVICES: Service[] = VENUE.services;

export function serviceById(id: ServiceId): Service {
  const service = SERVICES.find((item) => item.id === id);
  if (!service) throw new Error(`Unknown service: ${id}`);
  return service;
}

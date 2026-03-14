import type { TimeSlot } from "../types";

type ParaTemplate = {
  slotNumber: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
};

// Static para/time grid (Excel-like). These times are fixed by product requirements.
const PARA_TEMPLATE: ParaTemplate[] = [
  { slotNumber: 1, startTime: "09:00", endTime: "10:15" },
  { slotNumber: 2, startTime: "10:25", endTime: "11:40" },
  { slotNumber: 3, startTime: "11:50", endTime: "13:05" },
  { slotNumber: 4, startTime: "13:50", endTime: "15:05" },
  { slotNumber: 5, startTime: "15:15", endTime: "16:30" },
  { slotNumber: 6, startTime: "16:40", endTime: "17:55" },
];

export type TimetableRow =
  | {
      type: "lesson";
      key: string;
      slotNumber: number;
      startTime: string;
      endTime: string;
      timeSlotId: string; // resolved from DB when possible
    }
  | {
      type: "break";
      key: string;
      label: string;
    };

export function isMissingTimeSlotId(timeSlotId: string) {
  return String(timeSlotId ?? "").startsWith("missing:");
}

export function getMissingTimeSlotSlotNumber(timeSlotId: string) {
  const m = /^missing:(\d+)$/.exec(String(timeSlotId ?? ""));
  return m ? Number(m[1]) : null;
}

export function buildTimetableRows(timeSlots: TimeSlot[]) {
  const bySlotNumber = new Map<number, TimeSlot>();
  for (const s of timeSlots) bySlotNumber.set(s.slotNumber, s);

  const templateBySlotNumber = new Map<number, ParaTemplate>();
  for (const p of PARA_TEMPLATE) templateBySlotNumber.set(p.slotNumber, p);

  // Slot numbers to show: union(template, db). This keeps the UI stable (1..6)
  // while still supporting additional DB-defined slots if they exist.
  const slotNumbers = new Set<number>();
  for (const p of PARA_TEMPLATE) slotNumbers.add(p.slotNumber);
  for (const s of timeSlots) slotNumbers.add(s.slotNumber);

  const orderedSlotNumbers = Array.from(slotNumbers)
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);

  const rows: TimetableRow[] = [];
  for (const slotNumber of orderedSlotNumbers) {
    const db = bySlotNumber.get(slotNumber);
    const tpl = templateBySlotNumber.get(slotNumber);

    rows.push({
      type: "lesson",
      key: `para:${slotNumber}`,
      slotNumber,
      startTime: db?.startTime ?? tpl?.startTime ?? "",
      endTime: db?.endTime ?? tpl?.endTime ?? "",
      timeSlotId: db?.id ?? `missing:${slotNumber}`,
    });

    if (slotNumber === 3) {
      rows.push({ type: "break", key: "__lunch__", label: "Lunch Break" });
    }
  }

  return rows;
}

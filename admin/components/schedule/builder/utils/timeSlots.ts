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

export function buildTimetableRows(timeSlots: TimeSlot[]) {
  const bySlotNumber = new Map<number, TimeSlot>();
  for (const s of timeSlots) bySlotNumber.set(s.slotNumber, s);

  const rows: TimetableRow[] = [];
  for (const para of PARA_TEMPLATE) {
    const db = bySlotNumber.get(para.slotNumber);
    rows.push({
      type: "lesson",
      key: `para:${para.slotNumber}`,
      slotNumber: para.slotNumber,
      startTime: para.startTime,
      endTime: para.endTime,
      timeSlotId: db?.id ?? `missing:${para.slotNumber}`,
    });

    if (para.slotNumber === 3) {
      rows.push({ type: "break", key: "__lunch__", label: "Lunch Break" });
    }
  }

  return rows;
}

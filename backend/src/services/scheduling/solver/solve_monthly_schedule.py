#!/usr/bin/env python3
import json
import sys
from typing import Any, Dict, List, Tuple, Optional

from ortools.sat.python import cp_model


def _fail(message: str, *, code: int = 400) -> None:
    out = {"ok": False, "error": {"message": message, "code": code}}
    sys.stdout.write(json.dumps(out))
    sys.exit(0)


def _read_stdin_json() -> Dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        _fail("Empty input")
    try:
        return json.loads(raw)
    except Exception:
        _fail("Invalid JSON")


def _as_str(v: Any) -> str:
    return "" if v is None else str(v)


def solve(payload: Dict[str, Any]) -> Dict[str, Any]:
    days = payload.get("days") or []
    time_slots = payload.get("timeSlots") or []
    lessons = payload.get("lessons") or []
    blocked = payload.get("blocked") or {}
    options = payload.get("options") or {}

    if not isinstance(days, list) or not days:
        return {"ok": False, "error": {"message": "No available days"}}
    if not isinstance(time_slots, list) or not time_slots:
        return {"ok": False, "error": {"message": "No available time slots"}}
    if not isinstance(lessons, list) or not lessons:
        return {"ok": False, "error": {"message": "No lessons requested"}}

    slot_count = len(time_slots)
    day_count = len(days)

    # Map timeIndex = dayIndex * slotCount + slotIndex
    time_count = day_count * slot_count

    blocked_teacher: Dict[str, set] = {}
    blocked_group: Dict[str, set] = {}
    blocked_room: Dict[str, set] = {}

    def _load_blocked(kind: str) -> Dict[str, set]:
        src = blocked.get(kind) or {}
        out: Dict[str, set] = {}
        if not isinstance(src, dict):
            return out
        for k, arr in src.items():
            if not isinstance(arr, list):
                continue
            s = set()
            for x in arr:
                try:
                    i = int(x)
                except Exception:
                    continue
                if 0 <= i < time_count:
                    s.add(i)
            out[_as_str(k)] = s
        return out

    blocked_teacher = _load_blocked("teacher")
    blocked_group = _load_blocked("group")
    blocked_room = _load_blocked("room")

    max_seconds = float(options.get("maxSeconds") or 10.0)

    model = cp_model.CpModel()

    # x[l][d][s] in {0,1} for allowed placements only.
    x: List[List[List[Optional[cp_model.IntVar]]]] = []

    # Helper indices
    lessons_by_teacher: Dict[str, List[int]] = {}
    lessons_by_group: Dict[str, List[int]] = {}
    lessons_by_room: Dict[str, List[int]] = {}
    lessons_by_rule: Dict[int, List[int]] = {}

    combos_group_subject = set()  # (groupId, subjectId)

    for li, lesson in enumerate(lessons):
        teacher_id = _as_str(lesson.get("teacherId"))
        group_id = _as_str(lesson.get("groupId"))
        subject_id = _as_str(lesson.get("subjectId"))
        room_id = lesson.get("roomId")
        room_id = _as_str(room_id) if room_id is not None else ""
        rule_index = int(lesson.get("ruleIndex") or 0)

        if not teacher_id or not group_id or not subject_id:
            return {
                "ok": False,
                "error": {"message": "Lesson is missing teacherId/groupId/subjectId"},
            }

        lessons_by_teacher.setdefault(teacher_id, []).append(li)
        lessons_by_group.setdefault(group_id, []).append(li)
        if room_id:
            lessons_by_room.setdefault(room_id, []).append(li)

        lessons_by_rule.setdefault(rule_index, []).append(li)
        combos_group_subject.add((group_id, subject_id))

        x_day: List[List[Optional[cp_model.IntVar]]] = []
        for di in range(day_count):
            x_slot: List[Optional[cp_model.IntVar]] = []
            for si in range(slot_count):
                time_index = di * slot_count + si

                # Filter out blocked placements from existing schedules/unavailability.
                if time_index in blocked_teacher.get(teacher_id, set()):
                    x_slot.append(None)
                    continue
                if time_index in blocked_group.get(group_id, set()):
                    x_slot.append(None)
                    continue
                if room_id and time_index in blocked_room.get(room_id, set()):
                    x_slot.append(None)
                    continue

                x_slot.append(model.NewBoolVar(f"x_l{li}_d{di}_s{si}"))
            x_day.append(x_slot)
        x.append(x_day)

    # Each lesson must be placed exactly once.
    for li in range(len(lessons)):
        vars_for_lesson: List[cp_model.IntVar] = []
        for di in range(day_count):
            for si in range(slot_count):
                v = x[li][di][si]
                if v is not None:
                    vars_for_lesson.append(v)
        if not vars_for_lesson:
            return {
                "ok": False,
                "error": {"message": "No feasible placement for at least one lesson"},
            }
        model.AddExactlyOne(vars_for_lesson)

    # Resource conflicts among generated lessons.
    # Teacher
    for teacher_id, lesson_indices in lessons_by_teacher.items():
        for di in range(day_count):
            for si in range(slot_count):
                vars_here: List[cp_model.IntVar] = []
                for li in lesson_indices:
                    v = x[li][di][si]
                    if v is not None:
                        vars_here.append(v)
                if len(vars_here) > 1:
                    model.Add(sum(vars_here) <= 1)

    # Group
    for group_id, lesson_indices in lessons_by_group.items():
        for di in range(day_count):
            for si in range(slot_count):
                vars_here: List[cp_model.IntVar] = []
                for li in lesson_indices:
                    v = x[li][di][si]
                    if v is not None:
                        vars_here.append(v)
                if len(vars_here) > 1:
                    model.Add(sum(vars_here) <= 1)

    # Room (optional)
    for room_id, lesson_indices in lessons_by_room.items():
        for di in range(day_count):
            for si in range(slot_count):
                vars_here: List[cp_model.IntVar] = []
                for li in lesson_indices:
                    v = x[li][di][si]
                    if v is not None:
                        vars_here.append(v)
                if len(vars_here) > 1:
                    model.Add(sum(vars_here) <= 1)

    # Soft constraints
    objective_terms: List[Tuple[int, cp_model.IntVar]] = []

    # (1) Avoid placing same subject many times in a row (adjacent slots same day, per group+subject)
    adjacency_penalties: List[cp_model.IntVar] = []
    for group_id, subject_id in combos_group_subject:
        # Presence vars: presence[day][slot] ∈ {0,1}
        presence: List[List[cp_model.IntVar]] = []
        lesson_indices = [
            li
            for li, lesson in enumerate(lessons)
            if _as_str(lesson.get("groupId")) == group_id
            and _as_str(lesson.get("subjectId")) == subject_id
        ]
        if not lesson_indices:
            continue

        for di in range(day_count):
            row: List[cp_model.IntVar] = []
            for si in range(slot_count):
                p = model.NewBoolVar(f"p_g{group_id}_s{subject_id}_d{di}_sl{si}")
                vars_here: List[cp_model.IntVar] = []
                for li in lesson_indices:
                    v = x[li][di][si]
                    if v is not None:
                        vars_here.append(v)
                if vars_here:
                    # sum is 0/1 (group can't have two in same slot)
                    model.Add(sum(vars_here) == p)
                else:
                    model.Add(p == 0)
                row.append(p)
            presence.append(row)

        for di in range(day_count):
            for si in range(slot_count - 1):
                p0 = presence[di][si]
                p1 = presence[di][si + 1]
                adj = model.NewBoolVar(f"adj_g{group_id}_s{subject_id}_d{di}_sl{si}")
                model.Add(adj <= p0)
                model.Add(adj <= p1)
                model.Add(adj >= p0 + p1 - 1)
                adjacency_penalties.append(adj)

    for adj in adjacency_penalties:
        # Weight adjacency relatively high
        objective_terms.append((10, adj))

    # (2) Spread each rule across the month: penalize >1 per day for same rule
    for rule_index, lesson_indices in lessons_by_rule.items():
        for di in range(day_count):
            daily_vars: List[cp_model.IntVar] = []
            for li in lesson_indices:
                for si in range(slot_count):
                    v = x[li][di][si]
                    if v is not None:
                        daily_vars.append(v)
            if not daily_vars:
                continue
            daily_count = model.NewIntVar(0, slot_count, f"rc_rule{rule_index}_d{di}")
            model.Add(daily_count == sum(daily_vars))
            excess = model.NewIntVar(0, slot_count, f"rex_rule{rule_index}_d{di}")
            model.Add(excess >= daily_count - 1)
            model.Add(excess >= 0)
            objective_terms.append((3, excess))

    # (3) Avoid overloading teachers in one day: minimize max daily load per teacher
    for teacher_id, lesson_indices in lessons_by_teacher.items():
        day_counts: List[cp_model.IntVar] = []
        for di in range(day_count):
            vars_day: List[cp_model.IntVar] = []
            for li in lesson_indices:
                for si in range(slot_count):
                    v = x[li][di][si]
                    if v is not None:
                        vars_day.append(v)
            if vars_day:
                c = model.NewIntVar(0, slot_count, f"tc_t{teacher_id}_d{di}")
                model.Add(c == sum(vars_day))
            else:
                c = model.NewIntVar(0, 0, f"tc_t{teacher_id}_d{di}")
            day_counts.append(c)

        max_load = model.NewIntVar(0, slot_count, f"tmax_{teacher_id}")
        model.AddMaxEquality(max_load, day_counts)
        objective_terms.append((1, max_load))

    # Minimize weighted objective
    if objective_terms:
        model.Minimize(sum(weight * var for (weight, var) in objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_seconds
    solver.parameters.num_search_workers = int(options.get("workers") or 8)

    status = solver.Solve(model)
    if status not in (
        cp_model.OPTIMAL,
        cp_model.FEASIBLE,
    ):
        return {"ok": False, "error": {"message": "No feasible schedule found"}}

    # Extract solution
    out_lessons: List[Dict[str, Any]] = []
    for li, lesson in enumerate(lessons):
        assigned: Optional[Tuple[int, int]] = None
        for di in range(day_count):
            for si in range(slot_count):
                v = x[li][di][si]
                if v is not None and solver.Value(v) == 1:
                    assigned = (di, si)
                    break
            if assigned:
                break

        if not assigned:
            return {
                "ok": False,
                "error": {"message": "Solver returned incomplete assignment"},
            }

        di, si = assigned
        out_lessons.append(
            {
                "date": days[di]["date"],
                "timeSlotId": time_slots[si]["id"],
                "groupId": lesson["groupId"],
                "teacherId": lesson["teacherId"],
                "subjectId": lesson["subjectId"],
                "roomId": lesson.get("roomId", None),
                "note": lesson.get("note", None),
            }
        )

    return {"ok": True, "generatedLessons": out_lessons}


def main() -> None:
    payload = _read_stdin_json()
    result = solve(payload)
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()

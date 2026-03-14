import type {
  DepartmentGroupAssignment,
  DepartmentGroupDepartment,
} from "../types";

const DEFAULT_RANK = 999;

const DEPARTMENT_ORDER: DepartmentGroupDepartment[] = [
  "IT",
  "Japanese",
  "Partner University",
  "Language University",
];

const DEPT_RANK: ReadonlyMap<DepartmentGroupDepartment, number> = new Map(
  DEPARTMENT_ORDER.map((d, i) => [d, i] as const),
);

export function getDepartmentRank(
  dept: DepartmentGroupDepartment | null | undefined,
): number {
  if (!dept) return DEFAULT_RANK;
  return DEPT_RANK.get(dept) ?? DEFAULT_RANK;
}

export function sortGroupIdsForPosition(
  assignments: DepartmentGroupAssignment[],
  position: number,
): string[] {
  return assignments
    .filter((a) => a.position === position)
    .slice()
    .sort((a, b) => {
      const r =
        getDepartmentRank(a.department) - getDepartmentRank(b.department);
      if (r !== 0) return r;
      return a.groupId.localeCompare(b.groupId);
    })
    .map((a) => a.groupId);
}

import type {
  DepartmentGroupCategoryKey,
  DepartmentGroupDepartment,
} from "../types";

const PREFIX = "deptgroup:";

export function deptGroupCellDroppableId(
  departmentKey: DepartmentGroupCategoryKey,
  position: number,
) {
  return `${PREFIX}${departmentKey}@@${position}`;
}

export function parseDeptGroupCellDroppableId(id: string): {
  departmentKey: DepartmentGroupCategoryKey;
  position: number;
} | null {
  if (!id.startsWith(PREFIX)) return null;

  const rest = id.slice(PREFIX.length);
  const [departmentKeyRaw, positionRaw] = rest.split("@@");
  const position = Number(positionRaw);

  if (!Number.isInteger(position) || position < 0) return null;

  const departmentKey = departmentKeyRaw as DepartmentGroupCategoryKey;
  if (
    departmentKey !== "it" &&
    departmentKey !== "japanese" &&
    departmentKey !== "partner_university" &&
    departmentKey !== "language_university"
  ) {
    return null;
  }

  return { departmentKey, position };
}

export function deptKeyToDepartment(
  departmentKey: DepartmentGroupCategoryKey,
): DepartmentGroupDepartment {
  switch (departmentKey) {
    case "it":
      return "IT";
    case "japanese":
      return "Japanese";
    case "partner_university":
      return "Partner University";
    case "language_university":
      return "Language University";
  }
}

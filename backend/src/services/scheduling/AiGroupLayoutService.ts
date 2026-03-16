import { UserRole } from "@prisma/client";

import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { AiModelService } from "../ai/AiModelService";
import { AiSettingsService } from "../ai/AiSettingsService";
import { OpenAiCompatibleClient } from "../ai/OpenAiCompatibleClient";

type GroupMeta = {
  id: string;
  name: string;
  department: string;
  cohortCode: string | null;
  cohortSortOrder: number | null;
};

export type ArrangeLayoutResult = {
  assignments: Array<{ department: string; position: number; groupId: string }>;
  groupOrder: Array<string | null>;
  usedPositions: number;
  meta: {
    mode: "ai" | "deterministic";
    message?: string;
  };
};

function extractFirstJsonObject(text: string): any {
  const s = String(text ?? "");
  try {
    const direct = JSON.parse(s);
    if (direct && typeof direct === "object") return direct;
  } catch {
    // ignore
  }
  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) {
      const slice = s.slice(start, i + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeDepartment(value: string) {
  return String(value ?? "").trim();
}

function cohortSortKey(g: GroupMeta) {
  if (
    typeof g.cohortSortOrder === "number" &&
    Number.isFinite(g.cohortSortOrder)
  ) {
    return g.cohortSortOrder;
  }
  const code = g.cohortCode ?? "";
  const m = /\d+/.exec(code);
  return m ? Number(m[0]) : 999;
}

function deterministicArrange(params: {
  groups: GroupMeta[];
  maxColumns: number;
}): ArrangeLayoutResult {
  const maxColumns = Math.max(1, Math.min(Math.floor(params.maxColumns), 60));

  const byDept = new Map<string, GroupMeta[]>();
  for (const g of params.groups) {
    const dept = normalizeDepartment(g.department);
    if (!dept) continue;
    const list = byDept.get(dept) ?? [];
    list.push(g);
    byDept.set(dept, list);
  }

  const itGroups = (byDept.get("IT") ?? [])
    .slice()
    .sort((a, b) => {
      const r = cohortSortKey(a) - cohortSortKey(b);
      if (r !== 0) return r;
      const rc = String(a.cohortCode ?? "").localeCompare(
        String(b.cohortCode ?? ""),
      );
      if (rc !== 0) return rc;
      return a.name.localeCompare(b.name);
    })
    .slice(0, maxColumns);

  const assignments: ArrangeLayoutResult["assignments"] = [];
  const groupOrder: ArrangeLayoutResult["groupOrder"] = [];

  if (!itGroups.length) {
    return {
      assignments: [],
      groupOrder: [],
      usedPositions: 0,
      meta: { mode: "deterministic", message: "No IT groups found" },
    };
  }

  type Span = { code: string; start: number; end: number };
  const spans: Span[] = [];
  let current: Span | null = null;

  itGroups.forEach((g, position) => {
    assignments.push({ department: "IT", position, groupId: g.id });
    groupOrder[position] = g.id;

    const code = g.cohortCode ? String(g.cohortCode) : "";
    if (!code) return;

    if (!current || current.code !== code || current.end !== position - 1) {
      if (current) spans.push(current);
      current = { code, start: position, end: position };
    } else {
      current.end = position;
    }
  });
  if (current) spans.push(current);

  const byCohortFor = (dept: string) => {
    const out = new Map<string, GroupMeta[]>();
    const list = (byDept.get(dept) ?? []).slice();
    for (const g of list) {
      const code = g.cohortCode ? String(g.cohortCode) : "";
      if (!code) continue;
      const bucket = out.get(code) ?? [];
      bucket.push(g);
      out.set(code, bucket);
    }
    for (const [code, bucket] of out.entries()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name));
      out.set(code, bucket);
    }
    return out;
  };

  // Employability/Cowork: cohort-wide stored at span start
  const empByCohort = byCohortFor("Employability/Cowork");
  for (const s of spans) {
    const candidate = (empByCohort.get(s.code) ?? [])[0];
    if (!candidate) continue;
    assignments.push({
      department: "Employability/Cowork",
      position: s.start,
      groupId: candidate.id,
    });
  }

  const placeByCohortIntoSpan = (dept: string) => {
    const map = byCohortFor(dept);
    for (const s of spans) {
      const list = map.get(s.code) ?? [];
      for (let i = 0; i < list.length; i += 1) {
        const position = s.start + i;
        if (position > s.end) break;
        assignments.push({ department: dept, position, groupId: list[i].id });
      }
    }
  };

  placeByCohortIntoSpan("Partner University");
  placeByCohortIntoSpan("Language University");

  // Japanese: sequential across IT columns
  const jp = (byDept.get("Japanese") ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  for (let i = 0; i < Math.min(jp.length, itGroups.length); i += 1) {
    assignments.push({
      department: "Japanese",
      position: i,
      groupId: jp[i].id,
    });
  }

  return {
    assignments,
    groupOrder: Array.from(
      { length: itGroups.length },
      (_, i) => groupOrder[i] ?? null,
    ),
    usedPositions: itGroups.length,
    meta: { mode: "deterministic" },
  };
}

function getProviderConfig(provider: string): {
  apiUrl: string;
  apiKey: string;
  provider: "groq" | "openai";
} {
  const p = String(provider ?? "").toLowerCase();

  if (p === "openai") {
    const apiKey = process.env.OPENAI_API_KEY ?? "";
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    return {
      provider: "openai",
      apiUrl:
        process.env.OPENAI_API_URL ??
        "https://api.openai.com/v1/chat/completions",
      apiKey,
    };
  }

  const apiKey = process.env.GROQ_API_KEY ?? env.groqApiKey ?? "";
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  return {
    provider: "groq",
    apiUrl:
      process.env.GROQ_API_URL ??
      env.groqApiUrl ??
      "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
  };
}

export class AiGroupLayoutService {
  private readonly settings = new AiSettingsService();
  private readonly models = new AiModelService();
  private readonly llm = new OpenAiCompatibleClient();

  private async listGroups(): Promise<GroupMeta[]> {
    const rows = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        parentGroup: { select: { name: true } },
        cohort: { select: { code: true, sortOrder: true } },
      },
      orderBy: { name: "asc" },
      take: 1000,
    });

    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      department: g.parentGroup?.name ? String(g.parentGroup.name) : "",
      cohortCode: g.cohort?.code ? String(g.cohort.code) : null,
      cohortSortOrder:
        typeof g.cohort?.sortOrder === "number" &&
        Number.isFinite(g.cohort.sortOrder)
          ? g.cohort.sortOrder
          : null,
    }));
  }

  private validateResult(
    payload: any,
    knownGroupIds: Set<string>,
    maxColumns: number,
  ) {
    const assignments = Array.isArray(payload?.assignments)
      ? payload.assignments
      : null;
    const groupOrder = Array.isArray(payload?.groupOrder)
      ? payload.groupOrder
      : null;
    if (!assignments || !groupOrder) return null;

    const normalizedAssignments: ArrangeLayoutResult["assignments"] = [];
    for (const a of assignments) {
      const dept = normalizeDepartment(a?.department);
      const pos = Number(a?.position);
      const gid = String(a?.groupId ?? "");
      if (!dept) return null;
      if (!Number.isInteger(pos) || pos < 0 || pos >= maxColumns) return null;
      if (!gid || !knownGroupIds.has(gid)) return null;
      normalizedAssignments.push({
        department: dept,
        position: pos,
        groupId: gid,
      });
    }

    const normalizedOrder: Array<string | null> = groupOrder
      .slice(0, maxColumns)
      .map((x: any) => {
        if (x === null) return null;
        const gid = String(x ?? "");
        return knownGroupIds.has(gid) ? gid : null;
      });

    return { normalizedAssignments, normalizedOrder };
  }

  private async tryArrangeWithAi(params: {
    groups: GroupMeta[];
    maxColumns: number;
  }): Promise<ArrangeLayoutResult | null> {
    const settings = await this.settings.getOrCreate();
    if (!settings.isEnabled) return null;

    const allowed = await this.models.listAllowedForRole({
      role: UserRole.ADMIN,
    });
    const defaultModelId = settings.defaultAdminChatModelId;
    const chosen =
      (defaultModelId ? allowed.find((m) => m.id === defaultModelId) : null) ??
      allowed[0] ??
      null;

    const provider = chosen?.provider ?? "groq";
    const model =
      chosen?.model ??
      env.groqModel ??
      process.env.GROQ_MODEL ??
      "qwen/qwen3-32b";

    const providerCfg = getProviderConfig(provider);

    const groups = params.groups.map((g) => ({
      id: g.id,
      name: g.name,
      department: g.department,
      cohortCode: g.cohortCode,
      cohortSortOrder: g.cohortSortOrder,
    }));

    const system =
      "You are arranging school groups into a schedule builder grid. " +
      "Return ONLY valid JSON.\n" +
      "Goal: produce a layout that matches these rules:\n" +
      "- Primary columns are IT groups ordered by cohort (sortOrder/code) then name.\n" +
      "- Employability/Cowork is cohort-wide: for each IT cohort span, choose at most one Employability/Cowork group with matching cohortCode and put it at the span start position.\n" +
      "- Partner University and Language University: place groups by matching cohortCode into the same cohort span, left-to-right.\n" +
      "- Japanese: NOT cohort-ordered; place sequentially across columns.\n" +
      'Return JSON shape: { "assignments": [{department, position, groupId}], "groupOrder": [groupId|null, ...] }.';

    const user =
      "Input groups:\n" +
      JSON.stringify(groups) +
      "\n\nConstraints:\n" +
      JSON.stringify({ maxColumns: params.maxColumns }) +
      "\n";

    const res = await this.llm.chat({
      apiUrl: providerCfg.apiUrl,
      apiKey: providerCfg.apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });

    const parsed = extractFirstJsonObject(res.content);
    const knownGroupIds = new Set(params.groups.map((g) => g.id));
    const validated = this.validateResult(
      parsed,
      knownGroupIds,
      params.maxColumns,
    );
    if (!validated) return null;

    const usedPositions = Math.min(
      params.maxColumns,
      uniq(validated.normalizedOrder.filter(Boolean)).length,
    );

    return {
      assignments: validated.normalizedAssignments,
      groupOrder: validated.normalizedOrder,
      usedPositions,
      meta: { mode: "ai" },
    };
  }

  async arrangeLayout(params?: {
    maxColumns?: number;
  }): Promise<ArrangeLayoutResult> {
    const maxColumns =
      params?.maxColumns !== undefined &&
      Number.isFinite(Number(params.maxColumns))
        ? Math.max(1, Math.min(Math.floor(Number(params.maxColumns)), 60))
        : 30;

    const groups = await this.listGroups();

    try {
      const ai = await this.tryArrangeWithAi({ groups, maxColumns });
      if (ai) return ai;
    } catch (e: any) {
      // Fall back to deterministic arrangement
      return {
        ...deterministicArrange({ groups, maxColumns }),
        meta: {
          mode: "deterministic",
          message: String(e?.message ?? "AI arrange failed"),
        },
      };
    }

    return deterministicArrange({ groups, maxColumns });
  }
}

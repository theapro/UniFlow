import { cookies } from "next/headers";

export type ServerApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

export async function serverApiGet<T>(
  path: string,
  params?: Record<string, string | undefined | null>,
): Promise<ServerApiResult<T>> {
  const token = (await cookies()).get("token")?.value ?? null;

  const url = new URL(path, getBaseUrl());
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || String(v).trim() === "") continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null as any);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: json?.message ?? json?.error ?? `Request failed (${res.status})`,
    };
  }

  return { ok: true, data: (json?.data ?? json) as T };
}

export async function serverApiPost<T>(
  path: string,
  body: any,
): Promise<ServerApiResult<T>> {
  const token = (await cookies()).get("token")?.value ?? null;

  const url = new URL(path, getBaseUrl());
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null as any);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: json?.message ?? json?.error ?? `Request failed (${res.status})`,
    };
  }

  return { ok: true, data: (json?.data ?? json) as T };
}

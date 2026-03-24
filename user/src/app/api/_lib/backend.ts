import { NextRequest, NextResponse } from "next/server";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export function requireToken(req: NextRequest): string {
  const token = req.cookies.get("token")?.value;
  if (!token) throw new Error("UNAUTHORIZED");
  return token;
}

export async function proxyJson(
  req: NextRequest,
  input: RequestInfo,
  init?: RequestInit,
) {
  const token = requireToken(req);

  const res = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    return NextResponse.json(
      { error: text || res.statusText },
      { status: res.status },
    );
  }

  try {
    const json = text ? JSON.parse(text) : null;
    return NextResponse.json(json, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Invalid backend JSON" },
      { status: 502 },
    );
  }
}

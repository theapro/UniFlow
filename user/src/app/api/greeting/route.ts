import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/ai/greeting`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => "");
      return NextResponse.json(
        { error: errorText || backendResponse.statusText },
        { status: backendResponse.status },
      );
    }

    const json = await backendResponse.json();
    return NextResponse.json(json, { status: 200 });
  } catch (error) {
    console.error("Greeting API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

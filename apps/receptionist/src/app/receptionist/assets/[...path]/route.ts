import { NextResponse, type NextRequest } from "next/server";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".vrm") return "model/gltf-binary";
  if (ext === ".glb") return "model/gltf-binary";
  if (ext === ".gltf") return "model/gltf+json";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function getUserPublicDir(): string {
  // Monorepo layout:
  //   <repo>/apps/receptionist (process.cwd())
  //   <repo>/user/public
  return path.resolve(process.cwd(), "..", "..", "user", "public");
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { path: string[] } },
) {
  try {
    const segments = Array.isArray(ctx.params?.path) ? ctx.params.path : [];

    if (segments.length === 0) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Basic traversal protection
    for (const seg of segments) {
      if (!seg) return new NextResponse("Not found", { status: 404 });
      if (seg === "." || seg === "..") {
        return new NextResponse("Not found", { status: 404 });
      }
      if (seg.includes("/") || seg.includes("\\")) {
        return new NextResponse("Not found", { status: 404 });
      }
    }

    const baseDir = getUserPublicDir();
    const absPath = path.resolve(baseDir, ...segments);

    const rel = path.relative(baseDir, absPath);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const info = await stat(absPath);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });

    const buf = await readFile(absPath);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(absPath),
        // Keep dev snappy but still allow caching.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

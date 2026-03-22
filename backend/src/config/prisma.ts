import { PrismaClient } from "@prisma/client";
import {
  getAiDebugRuntime,
  prismaMiddlewareCapture,
} from "../services/ai-debug/aiDebugTrace";

declare global {
  var __prisma: PrismaClient | undefined;
}

const basePrisma = global.__prisma ?? new PrismaClient();

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const runtime = getAiDebugRuntime();

        if (!runtime) {
          return query(args);
        }

        const startedAtMs = Date.now();

        try {
          const result = await query(args);

          prismaMiddlewareCapture({
            model,
            action: operation,
            args,
            startedAtMs,
            endedAtMs: Date.now(),
            result,
            error: null,
          });

          return result;
        } catch (error) {
          prismaMiddlewareCapture({
            model,
            action: operation,
            args,
            startedAtMs,
            endedAtMs: Date.now(),
            result: null,
            error,
          });

          throw error;
        }
      },
    },
  },
});

// Prisma `$extends()` returns an extended client type that is not assignable to
// `PrismaClient` in some TS contexts. Most of the codebase expects `PrismaClient`,
// so we export the extended client with a `PrismaClient` type to keep typing
// consistent while preserving runtime behavior.
export const prisma = extendedPrisma as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

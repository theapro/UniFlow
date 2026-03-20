import { PrismaClient } from "@prisma/client";
import {
  getAiDebugRuntime,
  prismaMiddlewareCapture,
} from "../services/ai-debug/aiDebugTrace";

declare global {
  var __prisma: PrismaClient | undefined;
}

const basePrisma = global.__prisma ?? new PrismaClient();

export const prisma = basePrisma.$extends({
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

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
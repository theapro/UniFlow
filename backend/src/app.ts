import express from "express";
import cors from "cors";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { createRequestId, logError, logInfo, redact } from "./utils/logger";
import path from "path";

const app = express();

// This API is consumed by SPAs that expect JSON bodies.
// Express' default ETag/conditional GET can produce 304 responses with no body,
// which breaks axios/react-query flows (e.g. debug console listing endpoints).
app.set("etag", false);

// Request ID + request/response logging
app.use((req, res, next) => {
  const requestId = createRequestId();
  const startedAt = Date.now();

  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);

  logInfo("HTTP", "request", {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    origin: req.headers.origin,
    userAgent: req.headers["user-agent"],
  });

  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    logInfo("HTTP", "response", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
      user: (req as any).user,
    });
  });

  next();
});

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header)
      if (!origin) return callback(null, true);

      // In dev, Next.js may hop ports (3003, 3004, ...) if ports are busy.
      if (env.nodeEnv === "development") {
        if (/^http:\/\/localhost:\d+$/.test(origin)) {
          return callback(null, true);
        }
      }

      const allowList = new Set([
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
      ]);

      if (allowList.has(origin)) return callback(null, true);
      return callback(new Error(`CORS_NOT_ALLOWED:${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  express.json({
    limit: "1mb",
    // Capture raw body for webhook signature verification.
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.get("/health", (_req, res) => {
  return res.status(200).json({ success: true, message: "OK" });
});

// Static uploads (e.g. receptionist avatar models)
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"), {
    fallthrough: true,
  }),
);

app.use("/api", apiRoutes);

// Global Error Handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const requestId = (req as any).requestId;
    logError("HTTP", "unhandled error", {
      requestId,
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      code: err?.code,
      path: req.path,
      method: req.method,
      query: req.query,
      params: req.params,
      body: redact(req.body),
      user: (req as any).user,
      headers: redact({
        origin: req.headers.origin,
        authorization: req.headers.authorization,
        cookie: req.headers.cookie,
      }),
    });

    res.status(500).json({
      success: false,
      message: "Critical server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

export default app;

import express from "express";
import cors from "cors";
import apiRoutes from "./routes";

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
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

app.use("/api", apiRoutes);

// Global Error Handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("[Global Error Handler]:", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      message: "Critical server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

export default app;

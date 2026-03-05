import type { Response } from "express";

export function ok(res: Response, message: string, data?: unknown) {
  return res.status(200).json({
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
  });
}

export function created(res: Response, message: string, data?: unknown) {
  return res.status(201).json({
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
  });
}

export function fail(res: Response, status: number, message: string) {
  return res.status(status).json({
    success: false,
    message,
  });
}

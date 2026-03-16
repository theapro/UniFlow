"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { monthlyScheduleApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ScheduleMonthRow = {
  year: number;
  month: number;
  days: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthValue(row: { year: number; month: number }) {
  return `${row.year}-${pad2(row.month)}`;
}

export function ScheduleIndex(props: { lang: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ScheduleMonthRow[]>([]);

  const base = useMemo(() => `/${props.lang}/dashboard/schedule`, [props.lang]);

  const defaultCreateMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const res = await monthlyScheduleApi.months();
        const list = (res.data?.data ?? []) as ScheduleMonthRow[];
        if (!active) return;
        setRows(list);
      } catch (err: any) {
        if (!active) return;
        toast.error(
          err?.response?.data?.message ?? "Failed to load schedules list",
        );
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading
            ? "Loading schedules…"
            : rows.length
              ? `Schedules found: ${rows.length}`
              : "No schedules yet"}
        </div>

        <Button asChild>
          <Link
            href={`${base}/manage?month=${encodeURIComponent(defaultCreateMonth)}`}
          >
            Create new schedule
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loading && !rows.length ? (
            <div className="text-sm text-muted-foreground">
              No created schedules found. Use “Create new schedule” to start.
            </div>
          ) : null}

          <div className="space-y-2">
            {rows.map((r) => {
              const mv = monthValue(r);
              return (
                <div
                  key={mv}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{mv}</div>
                    <div className="text-xs text-muted-foreground">
                      Days with entries: {r.days}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <Link
                        href={`${base}/view?month=${encodeURIComponent(mv)}`}
                      >
                        View
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link
                        href={`${base}/manage?month=${encodeURIComponent(mv)}`}
                      >
                        Manage
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

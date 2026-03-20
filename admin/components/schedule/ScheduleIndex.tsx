"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Eye, 
  Settings2, 
  Plus, 
  Calendar as CalendarIcon,
  Loader2
} from "lucide-react";

import { monthlyScheduleApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ScheduleMonthRow = {
  year: number;
  month: number;
  days: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getMonthName(month: number, lang: string) {
  const date = new Date(2000, month - 1);
  return date.toLocaleString(lang === 'uz' ? 'uz-UZ' : 'en-US', { month: 'long' });
}

export function ScheduleIndex(props: { lang: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ScheduleMonthRow[]>([]);

  const base = useMemo(() => `/${props.lang}/dashboard/schedule`, [props.lang]);

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
        toast.error(err?.response?.data?.message ?? "Failed to load schedules");
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Statistika va Qidiruv qatori */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
          {loading ? "Updating..." : `Total periods: ${rows.length}`}
        </div>
      </div>

      {/* Asosiy Container - Ortiqcha borderlar olib tashlandi */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-border/60 p-12 text-center">
            <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground">No schedules created yet.</p>
          </div>
        ) : (
          rows.map((r) => {
            const mv = `${r.year}-${pad2(r.month)}`;
            return (
              <div
                key={mv}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] bg-muted/30 p-4 hover:bg-muted/20 transition-all duration-200 border border-transparent hover:border-border/40"
              >
                <div className="flex items-center gap-4">
                  {/* Sana belgisi */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/50 border border-border/40 font-mono text-sm font-bold shadow-sm">
                    {pad2(r.month)}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-foreground/90 leading-tight">
                      {getMonthName(r.month, props.lang)} {r.year}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-tight">
                        {r.days} Days Scheduled
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    asChild 
                    variant="ghost" 
                    className="h-10 rounded-xl hover:bg-background/80"
                  >
                    <Link href={`${base}/view?month=${encodeURIComponent(mv)}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                  <Button 
                    asChild 
                    className="h-10 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground border-none shadow-none"
                  >
                    <Link href={`${base}/manage?month=${encodeURIComponent(mv)}`}>
                      <Settings2 className="mr-2 h-4 w-4" />
                      Manage
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pastki qismdagi info */}
      {!loading && rows.length > 0 && (
        <div className="pt-4 text-center">
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.3em]">
            Academic Schedule Registry
          </p>
        </div>
      )}
    </div>
  );
}
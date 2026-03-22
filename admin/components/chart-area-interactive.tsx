"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { statsApi } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, Activity } from "lucide-react";

type LoginStatusResponse = {
  role: "STUDENT" | "TEACHER" | "ADMIN";
  totalAccounts: number;
  loggedIn: number;
  neverLoggedIn: number;
  integrity: {
    missingProfileLink: number;
    crossLinked: number;
  };
};

type ActivityPoint = { date: string; active: number; inactive: number };
type ActivityResponse = {
  range: "7d" | "30d" | "90d";
  totalUsers: number;
  activeNow: number;
  inactiveNow: number;
  series: ActivityPoint[];
};

const chartConfig = {
  active: {
    label: "Active Users",
    color: "hsl(var(--primary))",
  },
  inactive: {
    label: "Inactive",
    color: "rgba(255, 255, 255, 0.1)",
  },
} satisfies ChartConfig;

const loginStatusChartConfig = {
  loggedIn: {
    label: "Logged In",
    color: "hsl(var(--primary))",
  },
  neverLoggedIn: {
    label: "Never Logged In",
    color: "rgba(255, 255, 255, 0.1)",
  },
} satisfies ChartConfig;

export function RoleLoginStatusChart({
  role,
  title,
}: {
  role: "STUDENT" | "TEACHER";
  title: string;
}) {
  const [data, setData] = React.useState<LoginStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    statsApi
      .loginStatus(role)
      .then((res) => {
        if (!mounted) return;
        setData(res.data.data as LoginStatusResponse);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [role]);

  const series = [
    {
      label: "Accounts",
      loggedIn: data?.loggedIn ?? 0,
      neverLoggedIn: data?.neverLoggedIn ?? 0,
    },
  ];

  return (
    <div className="relative w-full p-8 space-y-8 transition-all duration-500">
      {/* CHART HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">
              Login Status
            </h3>
          </div>
          <p className="text-xl font-bold tracking-tight text-white/90">
            {title}
          </p>
        </div>

        {/* Keep existing control container (design), but make it single-value */}
        <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/5">
          <ToggleGroup type="single" value="all" className="hidden sm:flex">
            <ToggleGroupItem
              value="all"
              className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest rounded-lg data-[state=on]:bg-white/10 data-[state=on]:text-primary"
            >
              All
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="sm:hidden">
            <Select value="all" onValueChange={() => {}}>
              <SelectTrigger className="h-8 w-24 text-[10px] font-bold uppercase border-none bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-white/10">
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* CHART AREA */}
      <div className="relative h-[300px] w-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[2px]">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
          </div>
        )}

        <ChartContainer
          config={loginStatusChartConfig}
          className="h-full w-full"
        >
          <AreaChart data={series} margin={{ left: -20, right: 10 }}>
            <defs>
              <linearGradient
                id={`fillLoggedIn-${role}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-loggedIn)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-loggedIn)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.03)"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={15}
              minTickGap={40}
              tick={{
                fill: "rgba(255,255,255,0.2)",
                fontSize: 10,
                fontWeight: 600,
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  className="bg-zinc-950 border-white/10 rounded-2xl"
                />
              }
            />
            <Area
              dataKey="loggedIn"
              type="monotone"
              fill={`url(#fillLoggedIn-${role})`}
              stroke="var(--color-loggedIn)"
              strokeWidth={2}
              animationDuration={1500}
            />
            <Area
              dataKey="neverLoggedIn"
              type="monotone"
              fill="transparent"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* FOOTER METRICS */}
      <div className="flex items-center justify-between border-t border-white/5 pt-6 px-2">
        <div className="flex gap-8">
          <MiniMetric
            label="Logged In"
            value={data?.loggedIn}
            color="bg-primary"
          />
          <MiniMetric
            label="Never Logged In"
            value={data?.neverLoggedIn}
            color="bg-white/10"
          />
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
          <Activity size={12} />
          Role-based
        </div>
      </div>
    </div>
  );
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");
  const [data, setData] = React.useState<ActivityResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d");
  }, [isMobile]);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    statsApi
      .userActivity(timeRange as "7d" | "30d" | "90d")
      .then((res) => {
        if (mounted) setData(res.data.data as ActivityResponse);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [timeRange]);

  return (
    <div className="relative w-full p-8 space-y-8 transition-all duration-500">
      {/* CHART HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">
              User Engagement
            </h3>
          </div>
          <p className="text-xl font-bold tracking-tight text-white/90">
            Authentication Flow
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/5">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v)}
            className="hidden sm:flex"
          >
            {["7d", "30d", "90d"].map((range) => (
              <ToggleGroupItem
                key={range}
                value={range}
                className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest rounded-lg data-[state=on]:bg-white/10 data-[state=on]:text-primary"
              >
                {range}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="sm:hidden">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-8 w-24 text-[10px] font-bold uppercase border-none bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-white/10">
                <SelectItem value="7d">7D</SelectItem>
                <SelectItem value="30d">30D</SelectItem>
                <SelectItem value="90d">90D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* CHART AREA */}
      <div className="relative h-[300px] w-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[2px]">
            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
          </div>
        )}

        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart
            data={data?.series ?? []}
            margin={{ left: -20, right: 10 }}
          >
            <defs>
              <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-active)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-active)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.03)"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={15}
              minTickGap={40}
              tick={{
                fill: "rgba(255,255,255,0.2)",
                fontSize: 10,
                fontWeight: 600,
              }}
              tickFormatter={(v) => formatXAxis(v, timeRange)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  className="bg-zinc-950 border-white/10 rounded-2xl"
                />
              }
            />
            <Area
              dataKey="active"
              type="monotone"
              fill="url(#fillActive)"
              stroke="var(--color-active)"
              strokeWidth={2}
              animationDuration={1500}
            />
            <Area
              dataKey="inactive"
              type="monotone"
              fill="transparent"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* FOOTER METRICS */}
      <div className="flex items-center justify-between border-t border-white/5 pt-6 px-2">
        <div className="flex gap-8">
          <MiniMetric
            label="Currently Active"
            value={data?.activeNow}
            color="bg-primary"
          />
          <MiniMetric
            label="Offline"
            value={data?.inactiveNow}
            color="bg-white/10"
          />
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
          <Activity size={12} />
          Real-time Sync
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  color,
}: {
  label: string;
  value?: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <div className={cn("h-1 w-1 rounded-full", color)} />
        <span className="text-sm font-bold text-white/80 tabular-nums">
          {value ?? "—"}
        </span>
      </div>
    </div>
  );
}

function formatXAxis(value: string, range: string) {
  const date = new Date(value);
  if (range === "7d")
    return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

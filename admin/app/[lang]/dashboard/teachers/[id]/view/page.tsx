"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teachersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Calendar,
  ShieldCheck,
  Loader2,
  Hash,
  Briefcase,
  Phone,
  MessageSquare,
  Activity,
  MoreHorizontal,
  Send,
  BookOpen,
  Clock
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function TeacherViewPage({ params: { lang } }: { params: { lang: string } }) {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher", id],
    queryFn: () => teachersApi.getById(id as string).then((res) => res.data.data),
    enabled: !!id,
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: () => teachersApi.resendCredentials(id as string),
    onSuccess: () => {
      toast.success("Credentials sent successfully");
      queryClient.invalidateQueries({ queryKey: ["teacher", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (!teacher) return null;

  const hasLogin = !!teacher?.user?.lastLoginAt;
  const initials = teacher.fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="container max-w-7xl py-10 space-y-10 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-4">
          <Link
            href={`/${lang}/dashboard/teachers`}
            className="group inline-flex items-center text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-2 h-3 w-3 transition-transform group-hover:-translate-x-1" />
            Faculty Directory
          </Link>
          
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-xl font-black text-primary shadow-2xl">
              {initials}
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white leading-none mb-2">
                {teacher.fullName}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-primary/60 tracking-wider bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                  {teacher.staffNo || "NO-ID"}
                </span>
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  hasLogin ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500"
                )} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                  {hasLogin ? "System Active" : "Access Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-all"
              disabled={!teacher?.user?.email || resendCredentialsMutation.isPending}
              onClick={() => resendCredentialsMutation.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              Invite
            </Button>
            <Link href={`/${lang}/dashboard/teachers/${id}/edit`}>
              <Button className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/20 transition-all">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Record
              </Button>
            </Link>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Data Grid */}
        <div className="lg:col-span-8">
          <Card className="rounded-[32px] border-white/5 bg-zinc-900/20 backdrop-blur-md shadow-none overflow-hidden">
            <CardContent className="p-10 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
                <InfoBlock 
                  icon={Mail} 
                  label="Contact Email" 
                  value={teacher.user?.email || teacher.email} 
                  subValue="Primary communication address"
                />
                <InfoBlock 
                  icon={Briefcase} 
                  label="Department" 
                  value={teacher.department?.name} 
                  subValue="Academic organizational unit"
                />
                <InfoBlock 
                  icon={BookOpen} 
                  label="Specialization" 
                  value={teacher.subjects?.map((s: any) => s.name).join(", ")} 
                  subValue="Assigned disciplines"
                />
                <InfoBlock 
                  icon={Phone} 
                  label="Direct Line" 
                  value={teacher.phone} 
                  subValue="Mobile contact number"
                />
                <InfoBlock 
                  icon={Calendar} 
                  label="Registration" 
                  value={format(new Date(teacher.createdAt), "dd MMM, yyyy")} 
                  subValue="Profile creation date"
                />
                <InfoBlock 
                  icon={ShieldCheck} 
                  label="Security Audit" 
                  value={teacher.user?.lastLoginAt ? format(new Date(teacher.user.lastLoginAt), "dd MMM, HH:mm") : "Never accessed"} 
                  subValue="Last successful login"
                />
              </div>

              {teacher.note && (
                <div className="pt-6 border-t border-white/[0.03]">
                   <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 block mb-3">Internal Record Notes</span>
                   <p className="text-sm text-white/70 leading-relaxed font-medium bg-white/[0.02] p-4 rounded-2xl border border-white/[0.03]">
                    {teacher.note}
                   </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Metrics */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="rounded-[32px] border border-white/5 bg-zinc-900/20 p-8">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground/30 mb-8">
              System Metrics
            </h3>
            <div className="space-y-10">
              <StatItem 
                label="Account Standing" 
                value={hasLogin ? "Active" : "New"} 
                detail="Verification status"
              />
              <div className="h-px bg-white/[0.03]" />
              <StatItem 
                label="Course Load" 
                value={teacher.subjects?.length || "0"} 
                detail="Active subjects assigned"
              />
            </div>
          </div>

          <div className="rounded-[32px] border border-white/5 bg-zinc-900/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 ml-2 text-muted-foreground/40">
              <Activity className="h-4 w-4" />
              <span className="text-[10px] font-medium uppercase tracking-[0.2em]">
                Record Settings
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl hover:bg-white/5"
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-60 rounded-2xl border-white/10 p-2 shadow-2xl backdrop-blur-xl bg-zinc-950/95"
              >
                <DropdownMenuItem className="rounded-xl p-3 text-xs font-bold uppercase tracking-widest cursor-pointer">
                   <Clock className="mr-3 h-4 w-4 text-primary/60" />
                   View History
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl p-3 text-xs font-bold uppercase tracking-widest text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer">
                  <Activity className="mr-3 h-4 w-4" />
                  Restrict Access
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value, subValue, isMono = false }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 border border-white/10">
           <Icon className="h-3.5 w-3.5 text-primary/60" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">{label}</span>
      </div>
      <div className="space-y-1 pl-0.5">
        <p className={cn(
          "text-xl font-bold tracking-tight text-white/90", 
          isMono && "font-mono text-lg tracking-normal text-primary/80"
        )}>
          {value || "—"}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground/30">{subValue}</p>
      </div>
    </div>
  );
}

function StatItem({ label, value, detail }: any) {
  return (
    <div className="flex justify-between items-center group">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">
          {label}
        </p>
        <p className="text-[10px] font-normal text-muted-foreground/20 leading-none">
          {detail}
        </p>
      </div>
      <span className="text-3xl font-light tracking-tight text-white/80 group-hover:text-primary transition-colors duration-500">
        {value}
      </span>
    </div>
  );
}
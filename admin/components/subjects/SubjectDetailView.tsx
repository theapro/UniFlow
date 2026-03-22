"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, Pencil, Trash2, BookOpen, 
  Calendar, Briefcase, Hash, Clock,
  MoreHorizontal, Presentation, Gauge
} from "lucide-react";
import { toast } from "sonner";

import { subjectsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
  weeklyLessons: number; // Yangi
  totalLessons: number;  // Yangi
  cohort?: { id: string; code: string; year?: number | null } | null;
  parentGroup?: { id: string; name: string } | null;
  _count?: {
    teachers: number;
    lessons: number;
  };
};

export function SubjectDetailView({ lang, dict, id }: { lang: string; dict: any; id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const { data: subject, isLoading } = useQuery({
    queryKey: ["subjects", id],
    queryFn: () => subjectsApi.getById(id).then((r) => r.data.data as Subject),
  });

  const deleteMutation = useMutation({
    mutationFn: () => subjectsApi.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      router.push(`/${lang}/dashboard/subjects`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading details...</p>
      </div>
    );
  }

  if (!subject) return null;

  return (
    <div className="container max-w-7xl py-10 space-y-8 animate-in fade-in duration-700">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-4 px-1">
        <Link
          href={`/${lang}/dashboard/subjects`}
          className="group flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
        >
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        </Link>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">
            Subject Profile
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white/90 leading-none">
            {subject.name}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Essential Details */}
        <div className="lg:col-span-8">
          <Card className="rounded-[32px] border-border/40 bg-muted/10 backdrop-blur-md shadow-none overflow-hidden">
            <CardContent className="p-10">
              {/* Grid 3 ta ustun bo'lib ko'rinadi (md:grid-cols-2 bo'lgani uchun darslar pastga tushadi) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <InfoBlock 
                  icon={Briefcase} 
                  label="Academic Department" 
                  value={subject.parentGroup?.name ?? "Independent Subject"} 
                  description="Primary organizational unit"
                />
                <InfoBlock 
                  icon={Calendar} 
                  label="Enrollment Cohort" 
                  value={subject.cohort?.code ? `Cohort ${subject.cohort.code}` : "Cross-Cohort"} 
                  description="Academic year or group level"
                />
                <InfoBlock 
                  icon={Presentation} 
                  label="Weekly Intensity" 
                  value={`${subject.weeklyLessons} Lessons`} 
                  description="Lessons per academic week"
                />
                <InfoBlock 
                  icon={Gauge} 
                  label="Total Load" 
                  value={`${subject.totalLessons} Sessions`} 
                  description="Full curriculum duration"
                />
                <InfoBlock 
                  icon={Hash} 
                  label="Catalog Code" 
                  value={subject.code ?? "N/A"} 
                  isMono 
                  description="Internal identification code"
                />
                <InfoBlock 
                  icon={Clock} 
                  label="System ID & Audit" 
                  value={subject.id.slice(0, 8).toUpperCase()} 
                  isMono 
                  description={`Last update: ${new Date(subject.updatedAt).toLocaleDateString()}`}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Statistics & Actions */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-[32px] border border-border/40 bg-muted/10 p-8 space-y-8">
            <div className="space-y-6">
              <StatItem 
                label="Assigned Faculty" 
                value={subject._count?.teachers ?? 0} 
                subtext="Active teaching staff"
              />
              <div className="h-px bg-white/[0.05]" />
              <div className="flex justify-between items-center">
                 <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Scheduled</p>
                    <p className="text-[11px] text-muted-foreground/30 font-medium">Currently created lessons</p>
                 </div>
                 <span className="text-3xl font-light text-white/40">{subject._count?.lessons ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-border/40 bg-muted/10 p-4 flex items-center justify-between">
            <span className="ml-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Record Settings
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-border/40 bg-background/50 hover:bg-white/5">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/40 p-2 shadow-2xl backdrop-blur-xl">
                <DropdownMenuItem onClick={() => router.push(`/${lang}/dashboard/subjects/${subject.id}/edit`)} className="rounded-xl p-3 cursor-pointer">
                  <Pencil className="mr-2 h-4 w-4" /> Edit Subject
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="rounded-xl text-destructive focus:bg-destructive/10 focus:text-destructive p-3 cursor-pointer">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Subject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Confirm Deletion"
        description="Are you sure you want to remove this subject?"
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value, description, isMono = false }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 shadow-inner">
           <Icon className="h-4 w-4 text-muted-foreground/70" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">{label}</span>
      </div>
      <div className="space-y-1.5 pl-0.5">
        <p className={cn(
          "text-2xl font-semibold tracking-tight text-white/90", 
          isMono && "font-mono text-lg tracking-normal text-primary/80"
        )}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground/40 font-medium uppercase tracking-tight">{description}</p>
      </div>
    </div>
  );
}

function StatItem({ label, value, subtext }: any) {
  return (
    <div className="flex justify-between items-end group">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</p>
        <p className="text-[11px] text-muted-foreground/30 font-medium">{subtext}</p>
      </div>
      <span className="text-5xl font-light tracking-tighter text-white/80 group-hover:text-primary transition-colors">
        {value}
      </span>
    </div>
  );
}
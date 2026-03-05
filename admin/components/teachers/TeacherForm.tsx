"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTeacherInput, UpdateTeacherInput } from "@/types/teacher.types";

interface TeacherFormProps {
  teacher?: {
    id: string;
    fullName: string;
    staffNo: string | null;
    departmentId: string | null;
    user?: {
      email: string;
    } | null;
  };
  lang: string;
  dict: any;
  onSubmit: (data: CreateTeacherInput | UpdateTeacherInput) => Promise<void>;
}

export function TeacherForm({
  teacher,
  lang,
  dict,
  onSubmit,
}: TeacherFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(teacher?.fullName || "");
  const [email, setEmail] = useState(teacher?.user?.email || "");
  const [staffNo, setStaffNo] = useState(teacher?.staffNo || "");
  const [departmentId, setDepartmentId] = useState(teacher?.departmentId || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        fullName,
        ...(email ? { email } : {}),
        staffNo: staffNo || null,
        departmentId: departmentId || null,
      });
      router.push(`/${lang}/dashboard/teachers`);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {teacher ? dict.teachers.editTitle : dict.teachers.createTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{dict.teachers.fullName}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{dict.teachers.email || "Email"}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!teacher}
              placeholder="user@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffNo">{dict.teachers.staffNo}</Label>
            <Input
              id="staffNo"
              value={staffNo}
              onChange={(e) => setStaffNo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentId">{dict.teachers.department}</Label>
            <Input
              id="departmentId"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="Department ID"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? dict.common.loading : dict.common.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {dict.common.cancel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

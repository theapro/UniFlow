"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { universityDataApi } from "@/lib/api";

import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ReceptionistLanguage = "UZ" | "EN" | "JP";
const LANGS: ReceptionistLanguage[] = ["UZ", "EN", "JP"];

type University = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type Diploma = {
  id: string;
  universityId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  university?: { id: string; name: string };
};

type Department = {
  id: string;
  universityId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  university?: { id: string; name: string };
};

type Specialty = {
  id: string;
  departmentId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: string;
    name: string;
    university?: { id: string; name: string };
  };
};

type Fee = {
  id: string;
  universityId: string;
  specialtyId: string | null;
  title: string;
  amount: any;
  currency: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  university?: { id: string; name: string };
  specialty?: { id: string; name: string } | null;
};

type Facility = {
  id: string;
  universityId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  university?: { id: string; name: string };
};

type Announcement = {
  id: string;
  universityId: string | null;
  title: string;
  content: string;
  targetAudience: string;
  language: ReceptionistLanguage | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AiKnowledge = {
  id: string;
  title: string;
  content: string;
  category: string;
  language: ReceptionistLanguage;
  tags: any | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

function safeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function UniversityDataView({
  lang,
  dict,
}: {
  lang: string;
  dict: any;
}) {
  return (
    <div className="container max-w-7xl py-10 space-y-10">
      <PageHeader
        title={dict?.nav?.universityData ?? "University Data"}
        description="Manage university info and AI knowledge used by the receptionist."
      />

      <Tabs defaultValue="universities" className="space-y-6">
        <TabsList className="h-auto flex flex-wrap justify-start">
          <TabsTrigger value="universities">Universities</TabsTrigger>
          <TabsTrigger value="diplomas">Diplomas</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="specialties">Specialties</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="ai-knowledge">AI Knowledge</TabsTrigger>
        </TabsList>

        <TabsContent value="universities">
          <UniversitiesTab dict={dict} />
        </TabsContent>
        <TabsContent value="diplomas">
          <DiplomasTab dict={dict} />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsTab dict={dict} />
        </TabsContent>
        <TabsContent value="specialties">
          <SpecialtiesTab dict={dict} />
        </TabsContent>
        <TabsContent value="fees">
          <FeesTab dict={dict} />
        </TabsContent>
        <TabsContent value="facilities">
          <FacilitiesTab dict={dict} />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsTab dict={dict} />
        </TabsContent>
        <TabsContent value="ai-knowledge">
          <AiKnowledgeTab dict={dict} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UniversitiesTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<University | null>(null);

  const { data: universities, isLoading } = useQuery({
    queryKey: ["university-data", "universities"],
    queryFn: async () => {
      const res = await universityDataApi.universities.list({ take: 500 });
      return (res.data.data ?? []) as University[];
    },
  });

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setEditorOpen(true);
  };

  const openEdit = (row: University) => {
    setEditing(row);
    setName(row.name ?? "");
    setDescription(row.description ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      };

      if (editing) {
        const res = await universityDataApi.universities.update(
          editing.id,
          payload,
        );
        return res.data.data as University;
      }

      const res = await universityDataApi.universities.create(payload);
      return res.data.data as University;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "universities"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => universityDataApi.universities.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "universities"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Universities</CardTitle>
          <CardDescription>Top-level university entities.</CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (universities ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (universities ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(u.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(u)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(u.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} University</DialogTitle>
            <DialogDescription>
              Basic identifying information.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={!name.trim() || upsertMutation.isPending}
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete university?"
        description="This will permanently delete the university. If it is referenced by other records, the delete may be blocked."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

function DiplomasTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Diploma | null>(null);

  const { data: universities } = useQuery({
    queryKey: ["university-data", "universities"],
    queryFn: async () => {
      const res = await universityDataApi.universities.list({ take: 500 });
      return (res.data.data ?? []) as University[];
    },
  });

  const { data: diplomas, isLoading } = useQuery({
    queryKey: ["university-data", "diplomas"],
    queryFn: async () => {
      const res = await universityDataApi.diplomas.list({ take: 500 });
      return (res.data.data ?? []) as Diploma[];
    },
  });

  const [universityId, setUniversityId] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setUniversityId("");
    setName("");
    setDescription("");
    setEditorOpen(true);
  };

  const openEdit = (row: Diploma) => {
    setEditing(row);
    setUniversityId(row.universityId ?? "");
    setName(row.name ?? "");
    setDescription(row.description ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        universityId,
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      };

      if (editing) {
        const res = await universityDataApi.diplomas.update(
          editing.id,
          payload,
        );
        return res.data.data as Diploma;
      }

      const res = await universityDataApi.diplomas.create(payload);
      return res.data.data as Diploma;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "diplomas"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => universityDataApi.diplomas.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "diplomas"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const uniName = (id: string) =>
    (universities ?? []).find((u) => u.id === id)?.name ?? id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Diplomas</CardTitle>
          <CardDescription>University diploma types.</CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>University</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (diplomas ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (diplomas ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">
                      {d.university?.name ?? uniName(d.universityId)}
                    </TableCell>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(d.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(d.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} Diploma</DialogTitle>
            <DialogDescription>
              Attach diploma to a university.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>University</Label>
              <Select value={universityId} onValueChange={setUniversityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select university" />
                </SelectTrigger>
                <SelectContent>
                  {(universities ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                !universityId || !name.trim() || upsertMutation.isPending
              }
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete diploma?"
        description="This will permanently delete the diploma."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

function DepartmentsTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Department | null>(null);

  const { data: universities } = useQuery({
    queryKey: ["university-data", "universities"],
    queryFn: async () => {
      const res = await universityDataApi.universities.list({ take: 500 });
      return (res.data.data ?? []) as University[];
    },
  });

  const { data: departments, isLoading } = useQuery({
    queryKey: ["university-data", "departments"],
    queryFn: async () => {
      const res = await universityDataApi.departments.list({ take: 1000 });
      return (res.data.data ?? []) as Department[];
    },
  });

  const [universityId, setUniversityId] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setUniversityId("");
    setName("");
    setDescription("");
    setEditorOpen(true);
  };

  const openEdit = (row: Department) => {
    setEditing(row);
    setUniversityId(row.universityId ?? "");
    setName(row.name ?? "");
    setDescription(row.description ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        universityId,
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      };

      if (editing) {
        const res = await universityDataApi.departments.update(
          editing.id,
          payload,
        );
        return res.data.data as Department;
      }

      const res = await universityDataApi.departments.create(payload);
      return res.data.data as Department;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "departments"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => universityDataApi.departments.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "departments"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const uniName = (id: string) =>
    (universities ?? []).find((u) => u.id === id)?.name ?? id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Departments</CardTitle>
          <CardDescription>
            University departments (separate from academic DB departments).
          </CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>University</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (departments ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (departments ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">
                      {d.university?.name ?? uniName(d.universityId)}
                    </TableCell>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(d.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(d.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} Department</DialogTitle>
            <DialogDescription>
              Attach department to a university.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>University</Label>
              <Select value={universityId} onValueChange={setUniversityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select university" />
                </SelectTrigger>
                <SelectContent>
                  {(universities ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                !universityId || !name.trim() || upsertMutation.isPending
              }
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete department?"
        description="This will permanently delete the department. If it is referenced by specialties, the delete may be blocked."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

function SpecialtiesTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Specialty | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["university-data", "departments"],
    queryFn: async () => {
      const res = await universityDataApi.departments.list({ take: 1000 });
      return (res.data.data ?? []) as Department[];
    },
  });

  const { data: specialties, isLoading } = useQuery({
    queryKey: ["university-data", "specialties"],
    queryFn: async () => {
      const res = await universityDataApi.specialties.list({ take: 1000 });
      return (res.data.data ?? []) as Specialty[];
    },
  });

  const [departmentId, setDepartmentId] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setDepartmentId("");
    setName("");
    setDescription("");
    setEditorOpen(true);
  };

  const openEdit = (row: Specialty) => {
    setEditing(row);
    setDepartmentId(row.departmentId ?? "");
    setName(row.name ?? "");
    setDescription(row.description ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        departmentId,
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      };

      if (editing) {
        const res = await universityDataApi.specialties.update(
          editing.id,
          payload,
        );
        return res.data.data as Specialty;
      }

      const res = await universityDataApi.specialties.create(payload);
      return res.data.data as Specialty;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "specialties"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => universityDataApi.specialties.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "specialties"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const deptLabel = (id: string) => {
    const d = (departments ?? []).find((x) => x.id === id);
    if (!d) return id;
    const uni = d.university?.name ? `${d.university.name} — ` : "";
    return `${uni}${d.name}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Specialties</CardTitle>
          <CardDescription>Specialties under departments.</CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (specialties ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (specialties ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">
                      {s.department?.name
                        ? `${s.department.university?.name ?? ""}${s.department.university?.name ? " — " : ""}${s.department.name}`
                        : deptLabel(s.departmentId)}
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(s.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} Specialty</DialogTitle>
            <DialogDescription>
              Attach specialty to a department.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {`${d.university?.name ?? ""}${d.university?.name ? " — " : ""}${d.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                !departmentId || !name.trim() || upsertMutation.isPending
              }
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete specialty?"
        description="This will permanently delete the specialty. If it is referenced by fees, the delete may be blocked."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

function FeesTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Fee | null>(null);

  const { data: universities } = useQuery({
    queryKey: ["university-data", "universities"],
    queryFn: async () => {
      const res = await universityDataApi.universities.list({ take: 500 });
      return (res.data.data ?? []) as University[];
    },
  });

  const { data: specialties } = useQuery({
    queryKey: ["university-data", "specialties"],
    queryFn: async () => {
      const res = await universityDataApi.specialties.list({ take: 1000 });
      return (res.data.data ?? []) as Specialty[];
    },
  });

  const { data: fees, isLoading } = useQuery({
    queryKey: ["university-data", "fees"],
    queryFn: async () => {
      const res = await universityDataApi.fees.list({ take: 1000 });
      return (res.data.data ?? []) as Fee[];
    },
  });

  const [universityId, setUniversityId] = React.useState("");
  const [specialtyId, setSpecialtyId] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("UZS");
  const [description, setDescription] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setUniversityId("");
    setSpecialtyId("");
    setTitle("");
    setAmount("");
    setCurrency("UZS");
    setDescription("");
    setEditorOpen(true);
  };

  const openEdit = (row: Fee) => {
    setEditing(row);
    setUniversityId(row.universityId ?? "");
    setSpecialtyId(row.specialtyId ?? "");
    setTitle(row.title ?? "");
    setAmount(
      row.amount === null || row.amount === undefined ? "" : String(row.amount),
    );
    setCurrency(row.currency ?? "UZS");
    setDescription(row.description ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        universityId,
        specialtyId: specialtyId.trim() ? specialtyId.trim() : null,
        title: title.trim(),
        amount: amount.trim() ? amount.trim() : null,
        currency: currency.trim() ? currency.trim() : "UZS",
        description: description.trim() ? description.trim() : null,
      };

      if (editing) {
        const res = await universityDataApi.fees.update(editing.id, payload);
        return res.data.data as Fee;
      }

      const res = await universityDataApi.fees.create(payload);
      return res.data.data as Fee;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "fees"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => universityDataApi.fees.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "fees"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const uniName = (id: string) =>
    (universities ?? []).find((u) => u.id === id)?.name ?? id;

  const specName = (id: string | null) => {
    if (!id) return "—";
    return (specialties ?? []).find((s) => s.id === id)?.name ?? id;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Fees</CardTitle>
          <CardDescription>
            Tuition / contract fees (optional specialty link).
          </CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>University</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (fees ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (fees ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-muted-foreground">
                      {f.university?.name ?? uniName(f.universityId)}
                    </TableCell>
                    <TableCell className="font-medium">{f.title}</TableCell>
                    <TableCell>
                      {f.amount === null || f.amount === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="font-mono text-sm">
                          {String(f.amount)} {f.currency}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.specialty?.name ?? specName(f.specialtyId)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(f)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(f.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} Fee</DialogTitle>
            <DialogDescription>
              Fee record shown to receptionist as structured info.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>University</Label>
              <Select value={universityId} onValueChange={setUniversityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select university" />
                </SelectTrigger>
                <SelectContent>
                  {(universities ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Specialty (optional)</Label>
              <Select value={specialtyId} onValueChange={setSpecialtyId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {(specialties ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 12000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="UZS"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                !universityId || !title.trim() || upsertMutation.isPending
              }
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete fee?"
        description="This will permanently delete the fee."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

function FacilitiesTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Facility | null>(null);

  const { data: universities } = useQuery({
    queryKey: ["university-data", "universities"],
    queryFn: async () => {
      const res = await universityDataApi.universities.list({ take: 500 });
      return (res.data.data ?? []) as University[];
    },
  });

  const { data: facilities, isLoading } = useQuery({
    queryKey: ["university-data", "facilities"],
    queryFn: async () => {
      const res = await universityDataApi.facilities.list({ take: 1000 });
      return (res.data.data ?? []) as Facility[];
    },
  });

  const [universityId, setUniversityId] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setUniversityId("");
    setName("");
    setDescription("");
    setEditorOpen(true);
  };

  const openEdit = (row: Facility) => {
    setEditing(row);
    setUniversityId(row.universityId ?? "");
    setName(row.name ?? "");
    setDescription(row.description ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        universityId,
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      };

      if (editing) {
        const res = await universityDataApi.facilities.update(
          editing.id,
          payload,
        );
        return res.data.data as Facility;
      }

      const res = await universityDataApi.facilities.create(payload);
      return res.data.data as Facility;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "facilities"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => universityDataApi.facilities.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "facilities"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const uniName = (id: string) =>
    (universities ?? []).find((u) => u.id === id)?.name ?? id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Facilities</CardTitle>
          <CardDescription>
            Facilities / amenities per university.
          </CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>University</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (facilities ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (facilities ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-muted-foreground">
                      {f.university?.name ?? uniName(f.universityId)}
                    </TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(f.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(f)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(f.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} Facility</DialogTitle>
            <DialogDescription>
              Attach facility to a university.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>University</Label>
              <Select value={universityId} onValueChange={setUniversityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select university" />
                </SelectTrigger>
                <SelectContent>
                  {(universities ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                !universityId || !name.trim() || upsertMutation.isPending
              }
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete facility?"
        description="This will permanently delete the facility."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

function AnnouncementsTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Announcement | null>(null);

  const { data: universities } = useQuery({
    queryKey: ["university-data", "universities"],
    queryFn: async () => {
      const res = await universityDataApi.universities.list({ take: 500 });
      return (res.data.data ?? []) as University[];
    },
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["university-data", "announcements"],
    queryFn: async () => {
      const res = await universityDataApi.announcements.list({ take: 500 });
      return (res.data.data ?? []) as Announcement[];
    },
  });

  const [universityId, setUniversityId] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [targetAudience, setTargetAudience] = React.useState("");
  const [language, setLanguage] = React.useState<ReceptionistLanguage | "">("");
  const [isActive, setIsActive] = React.useState(true);
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setUniversityId("");
    setTitle("");
    setContent("");
    setTargetAudience("");
    setLanguage("");
    setIsActive(true);
    setStartsAt("");
    setEndsAt("");
    setEditorOpen(true);
  };

  const openEdit = (row: Announcement) => {
    setEditing(row);
    setUniversityId(row.universityId ?? "");
    setTitle(row.title ?? "");
    setContent(row.content ?? "");
    setTargetAudience(row.targetAudience ?? "");
    setLanguage(row.language ?? "");
    setIsActive(!!row.isActive);
    setStartsAt(toDateTimeLocalValue(row.startsAt));
    setEndsAt(toDateTimeLocalValue(row.endsAt));
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        universityId: universityId.trim() ? universityId.trim() : null,
        title: title.trim(),
        content: content.trim(),
        targetAudience: targetAudience.trim(),
        language: language ? (language as ReceptionistLanguage) : null,
        isActive,
        startsAt: startsAt ? startsAt : null,
        endsAt: endsAt ? endsAt : null,
      };

      if (editing) {
        const res = await universityDataApi.announcements.update(
          editing.id,
          payload,
        );
        return res.data.data as Announcement;
      }

      const res = await universityDataApi.announcements.create(payload);
      return res.data.data as Announcement;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "announcements"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      universityDataApi.announcements.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "announcements"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const uniName = (id: string | null) => {
    if (!id) return "All";
    return (universities ?? []).find((u) => u.id === id)?.name ?? id;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Announcements</CardTitle>
          <CardDescription>
            Optional university-scoped announcements.
          </CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>University</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (announcements ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (announcements ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">
                      {uniName(a.universityId)}
                    </TableCell>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.targetAudience}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={a.isActive ? "default" : "secondary"}>
                          {a.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {a.language ? (
                          <Badge variant="outline">{a.language}</Badge>
                        ) : (
                          <Badge variant="outline">ALL</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Create"} Announcement
            </DialogTitle>
            <DialogDescription>
              Visible to receptionist users.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>University (optional)</Label>
              <Select value={universityId} onValueChange={setUniversityId}>
                <SelectTrigger>
                  <SelectValue placeholder="All universities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {(universities ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target audience</Label>
                <Input
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Applicants"
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All languages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ALL</SelectItem>
                    {LANGS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">
                  If disabled, it won't show in receptionist init.
                </div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starts at</Label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ends at</Label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                !title.trim() ||
                !content.trim() ||
                !targetAudience.trim() ||
                upsertMutation.isPending
              }
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete announcement?"
        description="This will permanently delete the announcement."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

function AiKnowledgeTab({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AiKnowledge | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["university-data", "ai-knowledge"],
    queryFn: async () => {
      const res = await universityDataApi.aiKnowledge.list({ take: 500 });
      return (res.data.data ?? []) as AiKnowledge[];
    },
  });

  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [language, setLanguage] = React.useState<ReceptionistLanguage>("UZ");
  const [priority, setPriority] = React.useState("0");
  const [tags, setTags] = React.useState("");
  const [content, setContent] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setCategory("");
    setLanguage("UZ");
    setPriority("0");
    setTags("");
    setContent("");
    setEditorOpen(true);
  };

  const openEdit = (row: AiKnowledge) => {
    setEditing(row);
    setTitle(row.title ?? "");
    setCategory(row.category ?? "");
    setLanguage(row.language ?? "UZ");
    setPriority(String(row.priority ?? 0));

    const rawTags = row.tags;
    if (Array.isArray(rawTags)) setTags(rawTags.join(", "));
    else if (typeof rawTags === "string") setTags(rawTags);
    else setTags("");

    setContent(row.content ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const tagsList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const priorityNum = Number(priority);
      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        language,
        priority: Number.isFinite(priorityNum) ? priorityNum : 0,
        ...(tagsList.length ? { tags: tagsList } : {}),
      };

      if (editing) {
        const res = await universityDataApi.aiKnowledge.update(
          editing.id,
          payload,
        );
        return res.data.data as AiKnowledge;
      }

      const res = await universityDataApi.aiKnowledge.create(payload);
      return res.data.data as AiKnowledge;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "ai-knowledge"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => universityDataApi.aiKnowledge.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["university-data", "ai-knowledge"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>AI Knowledge</CardTitle>
          <CardDescription>
            Highest-priority answers for the receptionist.
          </CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {dict?.common?.loading ?? "Loading..."}
                  </TableCell>
                </TableRow>
              ) : (entries ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {dict?.common?.noData ?? "No data available"}
                  </TableCell>
                </TableRow>
              ) : (
                (entries ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.category}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.language}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {e.priority}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(e)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Create"} AI Knowledge
            </DialogTitle>
            <DialogDescription>
              If a match is found, the receptionist will answer from this
              content first.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags (optional, comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                !title.trim() ||
                !category.trim() ||
                !content.trim() ||
                upsertMutation.isPending
              }
            >
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete AI knowledge entry?"
        description="This will permanently delete the entry."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </Card>
  );
}

"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { receptionistAdminApi } from "@/lib/api";

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
type ReceptionistPersonality = "FRIENDLY" | "FORMAL";

type AvatarSettings = {
  id: string;
  key: string;
  name: string;
  modelUrl: string | null;
  voice: string | null;
  language: ReceptionistLanguage;
  inputLanguage: ReceptionistLanguage;
  outputLanguage: ReceptionistLanguage;
  personality: ReceptionistPersonality;

  systemPrompt: string | null;
  responseStyle: string | null;
  maxResponseTokens: number;
  temperature: number;

  autoRefreshKnowledge: boolean;
  allowedTopics: any | null;
  blockedTopics: any | null;
  createdAt: string;
  updatedAt: string;
};

type AvatarPatch = Partial<{
  name: string;
  voice: string | null;
  inputLanguage: ReceptionistLanguage;
  outputLanguage: ReceptionistLanguage;
  personality: ReceptionistPersonality;

  systemPrompt: string | null;
  responseStyle: string | null;
  maxResponseTokens: number;
  temperature: number;

  autoRefreshKnowledge: boolean;
  allowedTopics: string | string[] | null;
  blockedTopics: string | string[] | null;
}>;

type KnowledgeBaseEntry = {
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

type Location = {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type Direction = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  fromLocation?: Location;
  toLocation?: Location;
};

type Announcement = {
  id: string;
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

const LANGS: ReceptionistLanguage[] = ["UZ", "EN", "JP"];
const PERSONALITIES: ReceptionistPersonality[] = ["FRIENDLY", "FORMAL"];

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

export function ReceptionistView({ lang, dict }: { lang: string; dict: any }) {
  return (
    <div className="container max-w-7xl py-10 space-y-10">
      <PageHeader
        title={dict?.nav?.receptionist ?? "Receptionist"}
        description="Manage LEIA settings and content."
      />

      <Tabs defaultValue="avatar" className="space-y-6">
        <TabsList className="h-auto flex flex-wrap justify-start">
          <TabsTrigger value="avatar">Avatar</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="directions">Directions</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="avatar">
          <AvatarTab />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBaseTab />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsTab />
        </TabsContent>

        <TabsContent value="directions">
          <DirectionsTab />
        </TabsContent>

        <TabsContent value="announcements">
          <AnnouncementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AvatarTab() {
  const queryClient = useQueryClient();

  const { data: avatar, isLoading } = useQuery({
    queryKey: ["receptionist-avatar"],
    queryFn: async () => {
      const res = await receptionistAdminApi.avatar.get();
      return res.data.data as AvatarSettings;
    },
  });

  const initialized = React.useRef(false);
  const [name, setName] = React.useState("");
  const [voice, setVoice] = React.useState("");
  const [inputLanguage, setInputLanguage] =
    React.useState<ReceptionistLanguage>("UZ");
  const [outputLanguage, setOutputLanguage] =
    React.useState<ReceptionistLanguage>("UZ");
  const [personality, setPersonality] =
    React.useState<ReceptionistPersonality>("FRIENDLY");

  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [responseStyle, setResponseStyle] = React.useState("");
  const [maxResponseTokens, setMaxResponseTokens] = React.useState("900");
  const [temperature, setTemperature] = React.useState("0.4");

  const [autoRefreshKnowledge, setAutoRefreshKnowledge] = React.useState(true);
  const [allowedTopics, setAllowedTopics] = React.useState("");
  const [blockedTopics, setBlockedTopics] = React.useState("");

  React.useEffect(() => {
    if (!avatar || initialized.current) return;
    setName(avatar.name ?? "");
    setVoice(avatar.voice ?? "");
    setInputLanguage(avatar.inputLanguage ?? avatar.language ?? "UZ");
    setOutputLanguage(avatar.outputLanguage ?? avatar.language ?? "UZ");
    setPersonality(avatar.personality ?? "FRIENDLY");

    setSystemPrompt(avatar.systemPrompt ?? "");
    setResponseStyle(avatar.responseStyle ?? "");
    setMaxResponseTokens(String(avatar.maxResponseTokens ?? 900));
    setTemperature(String(avatar.temperature ?? 0.4));
    setAutoRefreshKnowledge(avatar.autoRefreshKnowledge ?? true);

    const rawAllowed = avatar.allowedTopics;
    if (Array.isArray(rawAllowed)) setAllowedTopics(rawAllowed.join("\n"));
    else if (typeof rawAllowed === "string") setAllowedTopics(rawAllowed);
    else setAllowedTopics("");

    const rawBlocked = avatar.blockedTopics;
    if (Array.isArray(rawBlocked)) setBlockedTopics(rawBlocked.join("\n"));
    else if (typeof rawBlocked === "string") setBlockedTopics(rawBlocked);
    else setBlockedTopics("");

    initialized.current = true;
  }, [avatar]);

  const saveMutation = useMutation({
    mutationFn: async (patch: AvatarPatch) => {
      const res = await receptionistAdminApi.avatar.patch(patch);
      return res.data.data as AvatarSettings;
    },
    onSuccess: async () => {
      toast.success("Saved");
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-avatar"],
      });
    },
    onError: () => toast.error("Failed to save"),
  });

  const saveAll = () => {
    const patch: AvatarPatch = {
      name: name.trim() || "LEIA",
      voice: voice.trim() ? voice.trim() : null,
      inputLanguage,
      outputLanguage,
      personality,

      systemPrompt: systemPrompt.trim() ? systemPrompt : null,
      responseStyle: responseStyle.trim() ? responseStyle : null,
      autoRefreshKnowledge,
      allowedTopics: allowedTopics.trim() ? allowedTopics : null,
      blockedTopics: blockedTopics.trim() ? blockedTopics : null,
    };

    const maxTokens = Number(maxResponseTokens);
    if (Number.isFinite(maxTokens) && maxTokens > 0) {
      patch.maxResponseTokens = maxTokens;
    }

    const temp = Number(temperature);
    if (Number.isFinite(temp)) {
      patch.temperature = temp;
    }

    saveMutation.mutate(patch);
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Avatar settings</CardTitle>
          <CardDescription>
            Configure the receptionist voice and behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Voice</Label>
                <Input
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  placeholder="(optional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Input language (qabul qiluvchi)</Label>
                <Select
                  value={inputLanguage}
                  onValueChange={(v) =>
                    setInputLanguage(v as ReceptionistLanguage)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
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
                <Label>Output language (javob beruvchi)</Label>
                <Select
                  value={outputLanguage}
                  onValueChange={(v) =>
                    setOutputLanguage(v as ReceptionistLanguage)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
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
                <Label>Personality</Label>
                <Select
                  value={personality}
                  onValueChange={(v) =>
                    setPersonality(v as ReceptionistPersonality)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select personality" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONALITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Current model:{" "}
              {avatar?.modelUrl ? (
                <Badge variant="outline" className="font-mono">
                  {avatar.modelUrl}
                </Badge>
              ) : (
                <span>None</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personality & generation</CardTitle>
          <CardDescription>
            Control how the receptionist responds (system prompt, style, and
            sampling).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>System prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[140px]"
              placeholder="(optional)"
            />
          </div>

          <div className="space-y-2">
            <Label>Response style</Label>
            <Textarea
              value={responseStyle}
              onChange={(e) => setResponseStyle(e.target.value)}
              className="min-h-[120px]"
              placeholder="(optional)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max response tokens</Label>
              <Input
                type="number"
                value={maxResponseTokens}
                onChange={(e) => setMaxResponseTokens(e.target.value)}
                min={80}
                max={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge control</CardTitle>
          <CardDescription>
            Source priority: <span className="font-medium">DB</span> &gt;{" "}
            <span className="font-medium">Knowledge Base</span> &gt;{" "}
            <span className="font-medium">AI</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Label>Auto refresh knowledge</Label>
              <div className="text-sm text-muted-foreground">
                When disabled, the server keeps an in-memory snapshot until it
                restarts.
              </div>
            </div>
            <Switch
              checked={autoRefreshKnowledge}
              onCheckedChange={setAutoRefreshKnowledge}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Allowed topics</Label>
              <Textarea
                value={allowedTopics}
                onChange={(e) => setAllowedTopics(e.target.value)}
                placeholder="(comma or newline separated)"
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Blocked topics</Label>
              <Textarea
                value={blockedTopics}
                onChange={(e) => setBlockedTopics(e.target.value)}
                placeholder="(comma or newline separated)"
                className="min-h-[120px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button onClick={saveAll} disabled={!avatar || saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function KnowledgeBaseTab() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<KnowledgeBaseEntry | null>(null);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["receptionist-kb"],
    queryFn: async () => {
      const res = await receptionistAdminApi.knowledgeBase.list({ take: 200 });
      return (res.data.data ?? []) as KnowledgeBaseEntry[];
    },
  });

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [language, setLanguage] = React.useState<ReceptionistLanguage>("UZ");
  const [priority, setPriority] = React.useState("0");
  const [tags, setTags] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setCategory("");
    setLanguage("UZ");
    setPriority("0");
    setTags("");
    setEditorOpen(true);
  };

  const openEdit = (row: KnowledgeBaseEntry) => {
    setEditing(row);
    setTitle(row.title ?? "");
    setContent(row.content ?? "");
    setCategory(row.category ?? "");
    setLanguage(row.language ?? "UZ");
    setPriority(String(row.priority ?? 0));

    const rawTags = row.tags;
    if (Array.isArray(rawTags)) setTags(rawTags.join(", "));
    else if (typeof rawTags === "string") setTags(rawTags);
    else setTags("");

    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const tagsList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        language,
        priority: Number(priority),
        ...(tagsList.length ? { tags: tagsList } : {}),
      };

      if (editing) {
        const res = await receptionistAdminApi.knowledgeBase.update(
          editing.id,
          payload,
        );
        return res.data.data as KnowledgeBaseEntry;
      }

      const res = await receptionistAdminApi.knowledgeBase.create(payload);
      return res.data.data as KnowledgeBaseEntry;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["receptionist-kb"] });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      receptionistAdminApi.knowledgeBase.remove(id),
    onSuccess: async () => {
      toast.success("Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["receptionist-kb"] });
    },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add entry
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge base</CardTitle>
          <CardDescription>
            Entries used by the receptionist for answers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead className="text-right">Priority</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entries ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.language}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.priority}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(row.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!entries?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No entries
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit entry" : "Add entry"}</DialogTitle>
            <DialogDescription>
              Title, category, content, and language are required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

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
                onValueChange={(v) => setLanguage(v as ReceptionistLanguage)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
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
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Tags (comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[180px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditorOpen(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                upsertMutation.isPending ||
                !title.trim() ||
                !category.trim() ||
                !content.trim()
              }
            >
              {upsertMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete entry"
        description="Are you sure? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

function LocationsTab() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Location | null>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["receptionist-locations"],
    queryFn: async () => {
      const res = await receptionistAdminApi.locations.list({ take: 300 });
      return (res.data.data ?? []) as Location[];
    },
  });

  const [name, setName] = React.useState("");
  const [building, setBuilding] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [description, setDescription] = React.useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setBuilding("");
    setFloor("");
    setDescription("");
    setEditorOpen(true);
  };

  const openEdit = (row: Location) => {
    setEditing(row);
    setName(row.name ?? "");
    setBuilding(row.building ?? "");
    setFloor(row.floor ?? "");
    setDescription(row.description ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        building: building.trim() ? building.trim() : null,
        floor: floor.trim() ? floor.trim() : null,
        description: description.trim() ? description.trim() : null,
      };

      if (editing) {
        const res = await receptionistAdminApi.locations.update(
          editing.id,
          payload,
        );
        return res.data.data as Location;
      }

      const res = await receptionistAdminApi.locations.create(payload);
      return res.data.data as Location;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-locations"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => receptionistAdminApi.locations.remove(id),
    onSuccess: async () => {
      toast.success("Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-locations"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-directions"],
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(msg || "Delete failed");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add location
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>Places referenced by directions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(locations ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.building ?? "—"}</TableCell>
                    <TableCell>{row.floor ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(row.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!locations?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No locations
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit location" : "Add location"}
            </DialogTitle>
            <DialogDescription>Name is required.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Building</Label>
              <Input
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="(optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="(optional)"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px]"
                placeholder="(optional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditorOpen(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={upsertMutation.isPending || !name.trim()}
            >
              {upsertMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete location"
        description="Are you sure? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

function DirectionsTab() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Direction | null>(null);

  const { data: locations } = useQuery({
    queryKey: ["receptionist-locations"],
    queryFn: async () => {
      const res = await receptionistAdminApi.locations.list({ take: 800 });
      return (res.data.data ?? []) as Location[];
    },
  });

  const { data: directions, isLoading } = useQuery({
    queryKey: ["receptionist-directions"],
    queryFn: async () => {
      const res = await receptionistAdminApi.directions.list({ take: 300 });
      return (res.data.data ?? []) as Direction[];
    },
  });

  const [fromLocationId, setFromLocationId] = React.useState<string>("");
  const [toLocationId, setToLocationId] = React.useState<string>("");
  const [instructions, setInstructions] = React.useState<string>("");

  const openCreate = () => {
    setEditing(null);
    setFromLocationId("");
    setToLocationId("");
    setInstructions("");
    setEditorOpen(true);
  };

  const openEdit = (row: Direction) => {
    setEditing(row);
    setFromLocationId(row.fromLocationId);
    setToLocationId(row.toLocationId);
    setInstructions(row.instructions ?? "");
    setEditorOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fromLocationId,
        toLocationId,
        instructions: instructions.trim(),
      };

      if (editing) {
        const res = await receptionistAdminApi.directions.update(
          editing.id,
          payload,
        );
        return res.data.data as Direction;
      }

      const res = await receptionistAdminApi.directions.create(payload);
      return res.data.data as Direction;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-directions"],
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(msg || "Save failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      receptionistAdminApi.directions.remove(id),
    onSuccess: async () => {
      toast.success("Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-directions"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  const locationName = React.useCallback(
    (id: string) => locations?.find((l) => l.id === id)?.name ?? id,
    [locations],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add direction
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directions</CardTitle>
          <CardDescription>
            Walking directions between locations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Instructions</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(directions ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.fromLocation?.name ??
                        locationName(row.fromLocationId)}
                    </TableCell>
                    <TableCell>
                      {row.toLocation?.name ?? locationName(row.toLocationId)}
                    </TableCell>
                    <TableCell className="max-w-[520px] truncate">
                      {row.instructions}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {safeDate(row.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!directions?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No directions
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit direction" : "Add direction"}
            </DialogTitle>
            <DialogDescription>
              From, to, and instructions are required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {(locations ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>To</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {(locations ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Instructions</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-[160px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditorOpen(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                upsertMutation.isPending ||
                !fromLocationId ||
                !toLocationId ||
                !instructions.trim()
              }
            >
              {upsertMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete direction"
        description="Are you sure? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Announcement | null>(null);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["receptionist-announcements"],
    queryFn: async () => {
      const res = await receptionistAdminApi.announcements.list({ take: 200 });
      return (res.data.data ?? []) as Announcement[];
    },
  });

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [targetAudience, setTargetAudience] = React.useState("");
  const [language, setLanguage] = React.useState<ReceptionistLanguage | "">("");
  const [isActive, setIsActive] = React.useState(true);
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");

  const openCreate = () => {
    setEditing(null);
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
        title: title.trim(),
        content: content.trim(),
        targetAudience: targetAudience.trim(),
        language: language ? (language as ReceptionistLanguage) : null,
        isActive,
        startsAt: startsAt ? startsAt : null,
        endsAt: endsAt ? endsAt : null,
      };

      if (editing) {
        const res = await receptionistAdminApi.announcements.update(
          editing.id,
          payload,
        );
        return res.data.data as Announcement;
      }

      const res = await receptionistAdminApi.announcements.create(payload);
      return res.data.data as Announcement;
    },
    onSuccess: async () => {
      toast.success(editing ? "Updated" : "Created");
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-announcements"],
      });
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      receptionistAdminApi.announcements.remove(id),
    onSuccess: async () => {
      toast.success("Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["receptionist-announcements"],
      });
    },
    onError: () => toast.error("Delete failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add announcement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>
            Messages the receptionist can surface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(announcements ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.targetAudience}</TableCell>
                    <TableCell>
                      {row.language ? (
                        <Badge variant="outline">{row.language}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Any</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.isActive ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="secondary">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.startsAt ? safeDate(row.startsAt) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.endsAt ? safeDate(row.endsAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!announcements?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No announcements
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit announcement" : "Add announcement"}
            </DialogTitle>
            <DialogDescription>
              Title, audience, and content are required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Target audience</Label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={language || "ANY"}
                onValueChange={(v) =>
                  setLanguage(v === "ANY" ? "" : (v as any))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">Any</SelectItem>
                  {LANGS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Active</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[180px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditorOpen(false)}
              disabled={upsertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={
                upsertMutation.isPending ||
                !title.trim() ||
                !targetAudience.trim() ||
                !content.trim()
              }
            >
              {upsertMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete announcement"
        description="Are you sure? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

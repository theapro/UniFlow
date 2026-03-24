"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChatStore } from "@/store/chatStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildChatExportFilename,
  buildChatExportMarkdown,
  buildChatExportTxt,
  downloadTextFile,
} from "@/lib/chatExport";
import {
  PlusCircle,
  MessageCircleMore,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Mic,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarInput,
} from "@/components/ui/sidebar";
import { UserMenu, type CurrentUser } from "@/components/user-menu";

export function ChatSidebar({
  className,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user?: CurrentUser | null }) {
  const pathname = usePathname();
  const {
    sessions,
    currentSessionId,
    messages,
    createSession,
    deleteSession,
    renameSession,
    setCurrentSession,
  } = useChatStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const handleNewChat = async () => {
    await createSession();
  };

  const handleRename = (sessionId: string, currentTitle: string) => {
    setEditingId(sessionId);
    setEditValue(currentTitle);
  };

  const handleSaveRename = async (sessionId: string) => {
    if (editValue.trim()) {
      await renameSession(sessionId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleDelete = (sessionId: string, title: string) => {
    setDeleteTarget({ id: sessionId, title });
  };

  const exportSession = (params: {
    sessionId: string;
    title: string;
    format: "txt" | "md";
  }) => {
    const exportedAt = new Date();
    const sessionMessages = messages[params.sessionId] ?? [];

    const content =
      params.format === "md"
        ? buildChatExportMarkdown({
            title: params.title,
            sessionId: params.sessionId,
            messages: sessionMessages,
            exportedAt,
          })
        : buildChatExportTxt({
            title: params.title,
            sessionId: params.sessionId,
            messages: sessionMessages,
            exportedAt,
          });

    const filename = buildChatExportFilename({
      title: params.title,
      exportedAt,
      ext: params.format,
    });

    downloadTextFile({
      filename,
      content,
      mime:
        params.format === "md"
          ? "text/markdown;charset=utf-8"
          : "text/plain;charset=utf-8",
    });
  };

  return (
    <>
      <Sidebar
        collapsible="offcanvas"
        className={cn("text-sidebar-foreground", className)}
        {...props}
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="px-2">
                <a href="/" className="flex items-center gap-2">
                  <span className="text-base font-semibold">UniFlow AI</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname?.startsWith("/dashboard/chat")}
                    tooltip="Chat"
                  >
                    <Link
                      href="/dashboard/chat"
                      className="flex items-center gap-2"
                    >
                      <MessageCircleMore className="h-4 w-4" />
                      <span>Chat</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname?.startsWith("/dashboard/voice")}
                    tooltip="Voice Chat"
                  >
                    <Link
                      href="/dashboard/voice"
                      className="flex items-center gap-2"
                    >
                      <Mic className="h-4 w-4" />
                      <span>Voice Chat</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupAction onClick={handleNewChat} title="New chat">
              <PlusCircle />
            </SidebarGroupAction>
            <SidebarGroupContent>
              {sessions.length === 0 ? (
                <div className="px-2 py-6 text-sm text-sidebar-foreground/70">
                  Start a new conversation.
                </div>
              ) : (
                <SidebarMenu>
                  {sessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    const isEditing = editingId === session.id;

                    return (
                      <SidebarMenuItem key={session.id}>
                        {isEditing ? (
                          <div className="flex items-center gap-2 rounded-md px-2 py-1">
                            <SidebarInput
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveRename(session.id);
                                } else if (e.key === "Escape") {
                                  handleCancelRename();
                                }
                              }}
                              className="h-8"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSaveRename(session.id)}
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={handleCancelRename}
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setCurrentSession(session.id)}
                              tooltip={session.title}
                            >
                              <span>{session.title}</span>
                            </SidebarMenuButton>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SidebarMenuAction showOnHover title="Actions">
                                  <MoreHorizontal />
                                </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    exportSession({
                                      sessionId: session.id,
                                      title: session.title,
                                      format: "txt",
                                    })
                                  }
                                >
                                  <MessageCircleMore className="mr-2 h-4 w-4" />
                                  Export (.txt)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    exportSession({
                                      sessionId: session.id,
                                      title: session.title,
                                      format: "md",
                                    })
                                  }
                                >
                                  <MessageCircleMore className="mr-2 h-4 w-4" />
                                  Export (.md)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    handleRename(session.id, session.title)
                                  }
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() =>
                                    handleDelete(session.id, session.title)
                                  }
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          {user ? (
            <div className="border-t border-sidebar-border p-2">
              <UserMenu user={user} />
            </div>
          ) : null}
        </SidebarFooter>
      </Sidebar>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete
              {deleteTarget?.title ? ` “${deleteTarget.title}”` : " this chat"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                const id = deleteTarget.id;
                setDeleteTarget(null);
                await deleteSession(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

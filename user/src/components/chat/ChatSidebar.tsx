"use client";

import React, { useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarInput,
} from "@/components/ui/sidebar";

export function ChatSidebar({
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const {
    sessions,
    currentSessionId,
    createSession,
    deleteSession,
    renameSession,
    setCurrentSession,
  } = useChatStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleNewChat = async () => {
    const newSessionId = await createSession();
    setCurrentSession(newSessionId);
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

  const handleDelete = async (sessionId: string) => {
    if (confirm("Are you sure you want to delete this chat?")) {
      await deleteSession(sessionId);
    }
  };

  return (
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
                                  handleRename(session.id, session.title)
                                }
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => handleDelete(session.id)}
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
    </Sidebar>
  );
}

# Optional Enhancements

This document provides code examples for implementing optional features mentioned in the requirements.

## 1. Model Selection Dropdown

Add a model selector to the chat header.

### Update ChatHeader.tsx

```typescript
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Settings } from "lucide-react";
import { useTheme } from "next-themes";

interface ChatHeaderProps {
  title?: string;
  onSettingsClick?: () => void;
}

export function ChatHeader({ title = "UniFlow AI Chat", onSettingsClick }: ChatHeaderProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          UF
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  );
}
```

### Create Settings Component

Create `src/components/chat/ChatSettings.tsx`:

```typescript
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface ChatSettingsProps {
  model: string;
  temperature: number;
  onModelChange: (model: string) => void;
  onTemperatureChange: (temperature: number) => void;
  onClose: () => void;
}

const MODELS = [
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  { value: "llama2-70b-4096", label: "Llama 2 70B" },
  { value: "gemma-7b-it", label: "Gemma 7B" },
];

export function ChatSettings({
  model,
  temperature,
  onModelChange,
  onTemperatureChange,
  onClose,
}: ChatSettingsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Chat Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="model">AI Model</Label>
            <Select value={model} onValueChange={onModelChange}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="temperature">
              Temperature: {temperature.toFixed(1)}
            </Label>
            <Input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lower values make responses more focused, higher values more creative
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Update ChatLayout to use settings

Add state for settings and pass to API:

```typescript
const [settings, setSettings] = useState({
  model: "mixtral-8x7b-32768",
  temperature: 0.7,
});
const [showSettings, setShowSettings] = useState(false);

// In the fetch call:
body: JSON.stringify({
  messages: conversationMessages,
  model: settings.model,
  temperature: settings.temperature,
}),
```

## 2. System Prompt

Add a system prompt configuration.

### Update Zustand Store

Add to `src/store/chatStore.ts`:

```typescript
export type ChatStore = {
  // ... existing fields
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
};

// In the store:
systemPrompt: "You are a helpful AI assistant.",
setSystemPrompt: (prompt: string) => set({ systemPrompt: prompt }),
```

### Use system prompt in API

In `ChatLayout.tsx`, prepend system message:

```typescript
const conversationMessages = [
  { role: "system", content: useChatStore.getState().systemPrompt },
  ...currentMessages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  })),
  userMessage,
];
```

## 3. Token Counter

Add a token counter using a simple estimation.

### Create Token Counter Utility

Create `src/lib/tokenCounter.ts`:

```typescript
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

export function countMessagesTokens(
  messages: Array<{ role: string; content: string }>,
): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content);
  }, 0);
}
```

### Display Token Count

Add to `ChatInput.tsx`:

```typescript
import { estimateTokens } from "@/lib/tokenCounter";

// In component:
const tokenCount = estimateTokens(message);

// In JSX:
<p className="mt-2 text-xs text-muted-foreground text-center">
  ~{tokenCount} tokens | Press Enter to send, Shift+Enter for new line
</p>
```

## 4. Message Regeneration

Add ability to regenerate the last assistant response.

### Update ChatMessage Component

Add a regenerate button:

```typescript
interface ChatMessageProps {
  message: Message;
  onRegenerate?: () => void;
  isLast?: boolean;
}

// In JSX (for assistant messages only):
{!isUser && isLast && (
  <Button
    variant="outline"
    size="sm"
    onClick={onRegenerate}
    className="mt-2"
  >
    <RefreshCw className="h-4 w-4 mr-2" />
    Regenerate
  </Button>
)}
```

### Implement in ChatLayout

```typescript
const handleRegenerate = async () => {
  if (!currentSessionId) return;

  const messages = useChatStore.getState().messages[currentSessionId];
  if (messages.length < 2) return;

  // Remove last assistant message
  regenerateMessage(currentSessionId);

  // Get the last user message
  const lastUserMessage = messages[messages.length - 2];

  // Resend it
  await handleSendMessage(lastUserMessage.content);
};
```

## 5. Export Chat History

Add ability to export chat to markdown.

### Create Export Utility

Create `src/lib/export.ts`:

```typescript
import { Message } from "@/types/chat";

export function exportChatToMarkdown(
  messages: Message[],
  title: string,
): string {
  let markdown = `# ${title}\n\n`;
  markdown += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

  messages.forEach((msg) => {
    const role = msg.role === "user" ? "👤 You" : "🤖 Assistant";
    markdown += `### ${role}\n\n${msg.content}\n\n---\n\n`;
  });

  return markdown;
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Add Export Button

In `ChatSidebar.tsx`:

```typescript
import { Download } from "lucide-react";
import { exportChatToMarkdown, downloadMarkdown } from "@/lib/export";

const handleExport = (sessionId: string) => {
  const session = sessions.find(s => s.id === sessionId);
  const sessionMessages = messages[sessionId] || [];

  if (session && sessionMessages.length > 0) {
    const markdown = exportChatToMarkdown(sessionMessages, session.title);
    downloadMarkdown(markdown, `${session.title}.md`);
  }
};

// Add button in session list:
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8"
  onClick={() => handleExport(session.id)}
  title="Export"
>
  <Download className="h-4 w-4" />
</Button>
```

## 6. Search in Chat History

Add search functionality.

### Add Search to Sidebar

```typescript
const [searchQuery, setSearchQuery] = useState("");

const filteredSessions = sessions.filter((session) =>
  session.title.toLowerCase().includes(searchQuery.toLowerCase())
);

// Add search input:
<Input
  placeholder="Search chats..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="mb-2"
/>
```

## 7. Keyboard Shortcuts

Add global keyboard shortcuts.

### Create Keyboard Handler

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ctrl/Cmd + K for new chat
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      handleNewChat();
    }

    // Ctrl/Cmd + / for settings
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      setShowSettings(true);
    }
  };

  window.addEventListener("keydown", handleKeyPress);
  return () => window.removeEventListener("keydown", handleKeyPress);
}, []);
```

These enhancements can be implemented incrementally to add more functionality to your chat application!

# Project Structure

Complete folder structure of the UniFlow AI Chat application.

```
user/
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── components.json                   # shadcn/ui configuration
├── next.config.js                    # Next.js configuration
├── package.json                      # Dependencies and scripts
├── postcss.config.js                 # PostCSS configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
├── README.md                         # Full documentation
├── QUICKSTART.md                     # Quick start guide
├── ENHANCEMENTS.md                   # Optional features guide
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts          # Groq API streaming endpoint
│   │   ├── globals.css               # Global styles & CSS variables
│   │   ├── layout.tsx                # Root layout with providers
│   │   └── page.tsx                  # Home page
│   │
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatLayout.tsx        # Main chat layout component
│   │   │   ├── ChatSidebar.tsx       # Sidebar with session management
│   │   │   ├── ChatMessage.tsx       # Individual message display
│   │   │   ├── ChatInput.tsx         # Auto-resize message input
│   │   │   └── ChatHeader.tsx        # Header with theme toggle
│   │   │
│   │   ├── ui/
│   │   │   ├── button.tsx            # Button component
│   │   │   ├── input.tsx             # Input component
│   │   │   ├── textarea.tsx          # Textarea component
│   │   │   ├── scroll-area.tsx       # Scroll area component
│   │   │   ├── label.tsx             # Label component
│   │   │   └── select.tsx            # Select dropdown component
│   │   │
│   │   └── theme-provider.tsx        # Theme provider wrapper
│   │
│   ├── store/
│   │   └── chatStore.ts              # Zustand store for state management
│   │
│   ├── types/
│   │   └── chat.ts                   # TypeScript type definitions
│   │
│   └── lib/
│       └── utils.ts                  # Utility functions
│
└── node_modules/                     # Dependencies (installed via npm)
```

## File Descriptions

### Configuration Files

| File                 | Purpose                              |
| -------------------- | ------------------------------------ |
| `package.json`       | Project dependencies and npm scripts |
| `tsconfig.json`      | TypeScript compiler configuration    |
| `tailwind.config.ts` | Tailwind CSS theme configuration     |
| `next.config.js`     | Next.js framework configuration      |
| `postcss.config.js`  | PostCSS plugins configuration        |
| `components.json`    | shadcn/ui components configuration   |
| `.env.example`       | Environment variables template       |
| `.gitignore`         | Files to ignore in version control   |

### Application Code

#### Core App Files (`src/app/`)

- **`layout.tsx`**: Root layout component with theme provider and global styles
- **`page.tsx`**: Main page that renders the ChatLayout
- **`globals.css`**: Global CSS including Tailwind directives and custom styles
- **`api/chat/route.ts`**: Server-side API route for Groq streaming

#### Components (`src/components/`)

**Chat Components:**

- **`ChatLayout.tsx`**: Main container orchestrating the entire chat interface
- **`ChatSidebar.tsx`**: Left sidebar for managing chat sessions
- **`ChatMessage.tsx`**: Displays individual messages with markdown rendering
- **`ChatInput.tsx`**: Message input with auto-resize and keyboard shortcuts
- **`ChatHeader.tsx`**: Top header with branding and theme toggle

**UI Components** (from shadcn/ui):

- **`button.tsx`**: Reusable button with variants
- **`input.tsx`**: Text input component
- **`textarea.tsx`**: Multi-line text input
- **`scroll-area.tsx`**: Custom scrollable container
- **`label.tsx`**: Form label component
- **`select.tsx`**: Dropdown select component

**Providers:**

- **`theme-provider.tsx`**: Wraps app with next-themes provider

#### State Management (`src/store/`)

- **`chatStore.ts`**: Zustand store managing:
  - Chat sessions
  - Messages per session
  - Current session tracking
  - Loading/streaming states
  - LocalStorage persistence

#### Types (`src/types/`)

- **`chat.ts`**: TypeScript interfaces and types for:
  - Message
  - ChatSession
  - ChatStore
  - Groq API request/response types

#### Utilities (`src/lib/`)

- **`utils.ts`**: Helper functions:
  - `cn()`: Class name merging
  - `generateId()`: Unique ID generation
  - `formatDate()`: Date formatting
  - `generateChatTitle()`: Auto-generate chat titles

## Key Features by File

### Real-time Streaming

- **File**: `src/app/api/chat/route.ts`
- Implements server-sent events (SSE)
- Streams responses from Groq API
- Handles errors and connection management

### State Persistence

- **File**: `src/store/chatStore.ts`
- Uses Zustand with localStorage middleware
- Persists sessions and messages
- Automatic sync across tabs

### Markdown Rendering

- **File**: `src/components/chat/ChatMessage.tsx`
- Uses react-markdown with remarkGfm
- Syntax highlighting with react-syntax-highlighter
- Copy code functionality

### Theme Support

- **Files**:
  - `src/components/theme-provider.tsx`
  - `src/app/globals.css`
  - `src/components/chat/ChatHeader.tsx`
- Light/dark mode support
- System theme detection
- CSS variables for easy customization

### Auto-resize Input

- **File**: `src/components/chat/ChatInput.tsx`
- Dynamic textarea height
- Max height constraint
- Keyboard shortcuts (Enter/Shift+Enter)

## Component Hierarchy

```
App
└── ThemeProvider
    └── ChatLayout
        ├── ChatSidebar
        │   └── SessionList
        │       └── SessionItem[]
        └── Main
            ├── ChatHeader
            ├── MessageList
            │   └── ChatMessage[]
            └── ChatInput
```

## Data Flow

```
User Input (ChatInput)
    ↓
State Update (chatStore)
    ↓
API Request (route.ts)
    ↓
Groq API
    ↓
Stream Response
    ↓
Update UI (ChatMessage)
    ↓
Persist (localStorage)
```

## Technology Stack by File

| Technology               | Used In                              |
| ------------------------ | ------------------------------------ |
| Next.js 14               | All app/ files                       |
| React 18                 | All components                       |
| TypeScript               | All .ts/.tsx files                   |
| Zustand                  | chatStore.ts                         |
| TailwindCSS              | All component styling                |
| next-themes              | theme-provider.tsx, ChatHeader.tsx   |
| react-markdown           | ChatMessage.tsx                      |
| react-syntax-highlighter | ChatMessage.tsx                      |
| Groq API                 | api/chat/route.ts                    |
| Radix UI                 | UI components (button, select, etc.) |
| Lucide React             | Icons throughout                     |

## Commands

```bash
# Install dependencies
npm install

# Development mode (port 3002)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Environment Variables

Required in `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Performance Optimizations

1. **Edge Runtime**: API routes use edge runtime for faster responses
2. **Code Splitting**: Automatic with Next.js App Router
3. **Lazy Loading**: Components loaded on demand
4. **Memoization**: Prevents unnecessary re-renders
5. **Stream Processing**: Efficient handling of large responses

## Security Considerations

1. **API Key**: Stored server-side only (never exposed to client)
2. **Environment Variables**: Not committed to git
3. **Content Security**: Sanitized markdown rendering
4. **Error Handling**: Graceful error messages without leaking details

---

This structure provides a scalable, maintainable foundation for an AI chat application! 🚀

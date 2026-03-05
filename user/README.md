# UniFlow AI Chat

A production-ready AI chat application similar to ChatGPT, built with Next.js 14, React, TypeScript, and powered by Groq API.

## Features

✨ **Modern UI/UX**

- Clean, responsive design inspired by ChatGPT/Claude
- Dark mode support with theme toggle
- Smooth animations and transitions
- Mobile-friendly interface

💬 **Chat Features**

- Create, rename, and delete chat sessions
- Persistent chat history with localStorage
- Real-time streaming responses
- Markdown rendering with syntax highlighting
- Code blocks with copy button
- Message copy functionality
- Auto-scroll to latest message

🚀 **Technical Highlights**

- Next.js 14 App Router
- TypeScript for type safety
- Zustand for state management
- TailwindCSS for styling
- shadcn/ui components
- Groq API integration with streaming
- Edge runtime for API routes

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **AI Provider**: Groq API
- **Markdown**: react-markdown
- **Syntax Highlighting**: react-syntax-highlighter
- **Icons**: Lucide React
- **Theme**: next-themes

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Groq API key (get it from [console.groq.com](https://console.groq.com/keys))

### Installation

1. **Clone the repository and navigate to the user folder**

```bash
cd user
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

4. **Run the development server**

```bash
npm run dev
```

5. **Open your browser**

Navigate to [http://localhost:3002](http://localhost:3002)

## Project Structure

```
user/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.ts          # Groq API streaming endpoint
│   │   ├── globals.css               # Global styles
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Home page
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatLayout.tsx        # Main chat layout
│   │   │   ├── ChatSidebar.tsx       # Session management sidebar
│   │   │   ├── ChatMessage.tsx       # Message display component
│   │   │   ├── ChatInput.tsx         # Message input with auto-resize
│   │   │   └── ChatHeader.tsx        # Header with theme toggle
│   │   ├── ui/                       # shadcn/ui components
│   │   └── theme-provider.tsx        # Theme provider
│   ├── store/
│   │   └── chatStore.ts              # Zustand store
│   ├── types/
│   │   └── chat.ts                   # TypeScript types
│   └── lib/
│       └── utils.ts                  # Utility functions
├── .env.example                      # Environment variables template
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Key Features Explained

### Streaming Responses

The application uses server-sent events (SSE) to stream responses from the Groq API in real-time, providing a smooth user experience similar to ChatGPT.

### State Management

Zustand handles all application state including:

- Chat sessions and messages
- Current session tracking
- Loading and streaming states
- Persistent storage with localStorage

### Markdown Rendering

Messages support full Markdown syntax including:

- Code blocks with syntax highlighting
- Tables, lists, and blockquotes
- Links and images
- GitHub Flavored Markdown (GFM)

### Theme Support

Built-in dark/light mode with `next-themes`:

- System theme detection
- Manual theme toggle
- Smooth theme transitions
- CSS variables for easy customization

## API Configuration

The application uses Groq's OpenAI-compatible API endpoint:

- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Model**: `mixtral-8x7b-32768` (configurable)
- **Temperature**: `0.7` (configurable)
- **Streaming**: Enabled by default

## Customization

### Change AI Model

Edit `src/app/api/chat/route.ts`:

```typescript
const {
  messages,
  model = "llama2-70b-4096",
  temperature = 0.7,
} = await req.json();
```

Available Groq models:

- `mixtral-8x7b-32768`
- `llama2-70b-4096`
- `gemma-7b-it`

### Customize Theme Colors

Edit `src/app/globals.css` to change the color scheme:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  /* Add your custom colors */
}
```

### Adjust Port

Edit `package.json`:

```json
"scripts": {
  "dev": "next dev -p 3002"
}
```

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line in message
- **ESC**: Cancel message edit

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Performance Optimizations

- Edge runtime for API routes
- Lazy loading of components
- Optimized re-renders with React.memo
- Efficient state updates with Zustand
- Code splitting with Next.js

## Troubleshooting

### API Key Error

If you see "GROQ_API_KEY is not configured":

1. Make sure you created a `.env` file
2. Verify your API key is correct
3. Restart the development server

### Streaming Not Working

1. Check your browser supports SSE
2. Verify API key has correct permissions
3. Check browser console for errors

### Theme Not Persisting

Clear your browser's localStorage and refresh the page.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and Groq API

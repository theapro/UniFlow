# Quick Start Guide

This guide will help you get the UniFlow AI Chat application up and running in minutes.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 18 or higher installed
- ✅ A Groq API key (free at [console.groq.com](https://console.groq.com/keys))

## Installation Steps

### 1. Navigate to the user directory

```bash
cd user
```

### 2. Install dependencies

```bash
npm install
```

This will install all required packages including:

- Next.js 14
- React & TypeScript
- Zustand (state management)
- TailwindCSS (styling)
- react-markdown & react-syntax-highlighter
- shadcn/ui components
- And more...

### 3. Configure environment variables

Create a `.env` file in the `user` directory:

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` and add your Groq API key:

```env
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
```

**How to get a Groq API key:**

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key
5. Copy and paste it into your `.env` file

### 4. Run the development server

```bash
npm run dev
```

The application will start on [http://localhost:3002](http://localhost:3002)

### 5. Start chatting!

Open your browser and navigate to `http://localhost:3002`. You should see the chat interface.

## First Steps

1. **Create a new chat**: Click the "+" button in the sidebar
2. **Send a message**: Type in the input box at the bottom and press Enter
3. **Wait for response**: The AI will stream its response in real-time
4. **Manage chats**: Use the sidebar to switch between, rename, or delete chats

## Common Issues

### "GROQ_API_KEY is not configured"

**Solution**: Make sure you:

1. Created a `.env` file (not `.env.example`)
2. Added your actual API key
3. Restarted the development server

### Port 3002 already in use

**Solution**: Either:

- Stop the process using port 3002
- Or change the port in `package.json`:
  ```json
  "dev": "next dev -p 3003"
  ```

### Module not found errors

**Solution**:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Production Build

To create a production build:

```bash
npm run build
npm start
```

## What's Next?

- ✨ Check out [ENHANCEMENTS.md](ENHANCEMENTS.md) for optional features
- 📖 Read the full [README.md](README.md) for detailed documentation
- 🎨 Customize the theme in `src/app/globals.css`
- 🤖 Try different AI models in the API route

## Features Overview

### ✅ What's Included

- **Real-time streaming responses** - See AI responses as they're generated
- **Multiple chat sessions** - Create and manage multiple conversations
- **Markdown support** - Full markdown rendering with code highlighting
- **Dark mode** - Toggle between light and dark themes
- **Persistent storage** - Chats are saved in browser localStorage
- **Copy messages** - Easy copy buttons for all messages
- **Responsive design** - Works on desktop, tablet, and mobile

### 🎯 Try These Commands

Ask the AI to:

- Write code examples
- Explain complex topics
- Create lists and tables
- Generate markdown documentation
- Solve problems step-by-step

## Support

If you encounter any issues:

1. Check the browser console for errors
2. Verify your `.env` configuration
3. Make sure all dependencies are installed
4. Try clearing browser localStorage

---

Happy chatting! 🚀

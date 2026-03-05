# UniFlow Admin Dashboard

Modern admin dashboard for UniFlow University AI Assistant system built with Next.js 14, TypeScript, and shadcn/ui.

## Features

- 🎨 Modern UI with shadcn/ui components based on dashboard-01 template
- 🌍 Multi-language support (English/Uzbek) with dynamic routing
- 🔐 JWT authentication with role-based access control
- 📊 Complete CRUD operations for:
  - Students management
  - Teachers management
  - Subjects
  - Schedule
  - Attendance tracking
  - AI conversation monitoring
- 🚀 Built with Next.js 14 App Router
- 💾 TanStack Query for efficient data fetching
- 🎯 TypeScript for type safety
- 🎨 Tailwind CSS for styling

## Tech Stack

- **Framework**: Next.js 14.1.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui (Radix UI)
- **State Management**: TanStack Query 5.28
- **HTTP Client**: Axios 1.6.8
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:5000`

### Installation

1. Navigate to the admin directory:

```bash
cd admin
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.local.example .env.local
```

4. Update `.env.local` with your backend API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The app will redirect to `/en/dashboard` by default.

### Build

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm start
```

## Project Structure

```
admin/
├── app/                          # Next.js App Router
│   ├── [lang]/                   # Dynamic language routing
│   │   ├── dashboard/            # Dashboard layout
│   │   │   ├── students/         # Student management pages
│   │   │   ├── teachers/         # Teacher management pages
│   │   │   ├── subjects/         # Subjects pages
│   │   │   ├── schedule/         # Schedule pages
│   │   │   ├── attendance/       # Attendance pages
│   │   │   └── ai-monitor/       # AI monitoring pages
│   │   └── layout.tsx            # Language layout with QueryProvider
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Root redirect
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── dashboard/                # Dashboard components (Sidebar, Header, etc.)
│   ├── shared/                   # Shared components (DataTable, PageHeader, etc.)
│   ├── students/                 # Student-specific components
│   └── teachers/                 # Teacher-specific components
├── dictionaries/                 # i18n translation files
│   ├── en.json                   # English translations
│   └── uz.json                   # Uzbek translations
├── lib/                          # Utility functions
│   ├── api.ts                    # API client methods
│   ├── axios.ts                  # Axios instance configuration
│   ├── i18n.ts                   # Internationalization utilities
│   └── utils.ts                  # Helper functions
└── types/                        # TypeScript type definitions

## Multi-Language Support

The application supports English (en) and Uzbek (uz) languages with dynamic routing:

- English: `/en/dashboard/...`
- Uzbek: `/uz/dashboard/...`

Switch languages using the language switcher in the header. The current route path is preserved when switching languages.

## Available Routes

- `/[lang]/dashboard` - Dashboard overview with statistics
- `/[lang]/dashboard/students` - Students list
- `/[lang]/dashboard/students/create` - Create new student
- `/[lang]/dashboard/students/[id]` - View/Edit student details
- `/[lang]/dashboard/teachers` - Teachers list
- `/[lang]/dashboard/teachers/create` - Create new teacher
- `/[lang]/dashboard/teachers/[id]` - View/Edit teacher details
- `/[lang]/dashboard/subjects` - Subjects management
- `/[lang]/dashboard/schedule` - Schedule management
- `/[lang]/dashboard/attendance` - Attendance tracking
- `/[lang]/dashboard/ai-monitor` - AI conversation monitoring

## API Integration

The application connects to the backend API (default: `http://localhost:5000`).

Authentication is handled via JWT tokens stored in localStorage. The axios instance automatically:
- Adds `Authorization: Bearer <token>` header to all requests
- Redirects to login on 401 Unauthorized responses

## Component Library

Built with shadcn/ui components:
- Button
- Card
- Table
- Input
- Label
- Separator
- Dropdown Menu
- Avatar
- Alert Dialog

## Development Notes

- All pages use Server Components by default for better performance
- Client Components are marked with `"use client"` directive
- Data fetching uses TanStack Query for caching and optimistic updates
- Forms use controlled components with validation
- All API calls include proper error handling

## License

MIT
```

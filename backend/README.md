# UniFlow Backend API

University AI Assistant backend with Express, TypeScript, Prisma, PostgreSQL, JWT Authentication, and Role-based access control.

## Stack

- **Node.js** + **Express**
- **TypeScript**
- **Prisma ORM**
- **PostgreSQL**
- **JWT Authentication**
- **Role-based Access**: ADMIN, STUDENT, TEACHER

## Project Structure

```
src/
├── config/
│   ├── env.ts              # Environment configuration
│   ├── prisma.ts           # Prisma client singleton
│
├── middlewares/
│   ├── auth.middleware.ts  # JWT authentication
│   ├── role.middleware.ts  # Role-based authorization
│
├── routes/
│   ├── index.ts            # Main router
│   ├── admin.routes.ts     # Admin endpoints
│   ├── user.routes.ts      # Student/Teacher endpoints
│   ├── ai.routes.ts        # AI assistant endpoint
│
├── controllers/
│   ├── admin/
│   │   ├── AdminStudentController.ts
│   │   ├── AdminTeacherController.ts
│   │   ├── AdminScheduleController.ts
│   │   ├── AdminAttendanceController.ts
│   │   ├── AdminSubjectController.ts
│   │   ├── AdminGroupController.ts
│   │   ├── AdminLessonController.ts
│   │
│   ├── user/
│   │   ├── StudentController.ts
│   │   ├── TeacherController.ts
│   │   ├── ScheduleController.ts
│   │   ├── AttendanceController.ts
│   │
│   ├── ai/
│   │   ├── AiController.ts
│
├── services/
│   ├── admin/               # Admin business logic
│   ├── user/                # User business logic
│
├── types/
│   ├── express.d.ts         # Express type extensions
│   ├── ai.ts                # AI types
│
├── utils/
│   ├── responses.ts         # Response helpers
│   ├── weekday.ts           # Date/weekday utilities
│
├── app.ts                   # Express app setup
├── server.ts                # Server entry point
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/uniflow"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
```

### 3. Initialize database

```bash
# Recommended (source of truth): Prisma migrations + seed
npx prisma migrate deploy
npx prisma db seed

# Dev reset (drops all tables, re-applies migrations, re-seeds)
npm run db:reset

# Optional (legacy/manual): raw SQL schema init
# psql -U postgres -d uniflow -f database.sql
```

### 4. Run

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### Admin Routes (`/api/admin/*`)

**Auth:** JWT + ADMIN role

#### Students

- `GET /api/admin/students` - List students
- `GET /api/admin/students/:id` - Get student by ID
- `POST /api/admin/students` - Create student
- `PUT /api/admin/students/:id` - Update student
- `DELETE /api/admin/students/:id` - Delete student

#### Teachers

- `GET /api/admin/teachers` - List teachers
- `GET /api/admin/teachers/:id` - Get teacher by ID
- `POST /api/admin/teachers` - Create teacher
- `PUT /api/admin/teachers/:id` - Update teacher
- `DELETE /api/admin/teachers/:id` - Delete teacher

#### Schedule

- `GET /api/admin/schedule` - List schedule entries
- `GET /api/admin/schedule/:id` - Get schedule entry
- `POST /api/admin/schedule` - Create schedule entry
- `PUT /api/admin/schedule/:id` - Update schedule entry
- `DELETE /api/admin/schedule/:id` - Delete schedule entry

#### Attendance

- `GET /api/admin/attendance` - List attendance records
- `GET /api/admin/attendance/:id` - Get attendance record
- `POST /api/admin/attendance` - Create attendance record
- `POST /api/admin/attendance/bulk` - Bulk mark attendance
- `PUT /api/admin/attendance/:id` - Update attendance record
- `DELETE /api/admin/attendance/:id` - Delete attendance record

#### Subjects

- `GET /api/admin/subjects` - List subjects
- `GET /api/admin/subjects/:id` - Get subject
- `POST /api/admin/subjects` - Create subject
- `PUT /api/admin/subjects/:id` - Update subject
- `DELETE /api/admin/subjects/:id` - Delete subject

#### Groups

- `GET /api/admin/groups` - List groups
- `GET /api/admin/groups/:id` - Get group
- `POST /api/admin/groups` - Create group
- `PUT /api/admin/groups/:id` - Update group
- `DELETE /api/admin/groups/:id` - Delete group

#### Lessons

- `GET /api/admin/lessons` - List lessons
- `GET /api/admin/lessons/:id` - Get lesson
- `POST /api/admin/lessons` - Create lesson
- `PUT /api/admin/lessons/:id` - Update lesson
- `DELETE /api/admin/lessons/:id` - Delete lesson

### User Routes (`/api/user/*`)

**Auth:** JWT + STUDENT or TEACHER role

#### Student Endpoints

- `GET /api/user/student/me/schedule/today` - Get today's schedule (STUDENT)
- `GET /api/user/student/me/attendance` - Get own attendance (STUDENT)

#### Teacher Endpoints

- `GET /api/user/teacher/me/lessons/today` - Get today's lessons (TEACHER)
- `GET /api/user/teacher/me/groups/:groupId/schedule` - Get group schedule (TEACHER)

#### Common Endpoints

- `GET /api/user/schedule?weekday=MON` - Get schedule by weekday
- `POST /api/user/attendance/mark` - Mark attendance (TEACHER only)
- `GET /api/user/attendance/lesson/:lessonId` - Get lesson attendance (TEACHER only)

### AI Routes (`/api/ai/*`)

**Auth:** JWT (any role)

- `POST /api/ai/chat` - Chat with AI assistant
  ```json
  {
    "message": "Show me today's schedule"
  }
  ```

Note: `GET /api/ai/search` is ADMIN-only (it can expose sensitive data).

## Response Format

### Success

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "message": "Error message"
}
```

## Development

```bash
# Watch mode (Windows-friendly)
npm run dev

# If you prefer the old runner
npm run dev:legacy

# Type check
npx tsc --noEmit

# Prisma Studio (DB GUI)
npx prisma studio
```

## Architecture

- **Controllers**: Handle HTTP requests/responses, thin layer
- **Services**: Business logic, database operations
- **Middlewares**: Auth, role checks, error handling
- **Utils**: Reusable helpers

## License

MIT

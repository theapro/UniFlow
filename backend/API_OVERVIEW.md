# UniFlow API - Complete Structure

## ✅ Implementation Status: COMPLETE

All controllers, services, and routes have been implemented following clean architecture principles.

---

## 📁 Directory Structure

```
backend/src/
├── config/
│   ├── env.ts                              ✅ Environment configuration
│   └── prisma.ts                           ✅ Prisma client singleton
│
├── middlewares/
│   ├── auth.middleware.ts                  ✅ JWT authentication
│   └── role.middleware.ts                  ✅ Role-based authorization
│
├── routes/
│   ├── index.ts                            ✅ Main router aggregator
│   ├── admin.routes.ts                     ✅ Admin endpoints
│   ├── user.routes.ts                      ✅ Student/Teacher endpoints
│   └── ai.routes.ts                        ✅ AI assistant endpoint
│
├── controllers/
│   ├── admin/
│   │   ├── AdminStudentController.ts       ✅ CRUD for students
│   │   ├── AdminTeacherController.ts       ✅ CRUD for teachers
│   │   ├── AdminScheduleController.ts      ✅ CRUD for schedule entries
│   │   ├── AdminAttendanceController.ts    ✅ CRUD + bulk attendance
│   │   ├── AdminSubjectController.ts       ✅ CRUD for subjects
│   │   ├── AdminGroupController.ts         ✅ CRUD for groups
│   │   └── AdminLessonController.ts        ✅ CRUD for lessons
│   │
│   ├── user/
│   │   ├── StudentController.ts            ✅ Student endpoints
│   │   ├── TeacherController.ts            ✅ Teacher endpoints
│   │   ├── ScheduleController.ts           ✅ Schedule viewing
│   │   └── AttendanceController.ts         ✅ Attendance marking
│   │
│   └── ai/
│       └── AiController.ts                 ✅ AI intent detection + service calls
│
├── services/
│   ├── admin/
│   │   ├── AdminStudentService.ts          ✅ Student business logic
│   │   ├── AdminTeacherService.ts          ✅ Teacher business logic
│   │   ├── AdminScheduleService.ts         ✅ Schedule business logic
│   │   ├── AdminAttendanceService.ts       ✅ Attendance business logic
│   │   ├── AdminSubjectService.ts          ✅ Subject business logic
│   │   ├── AdminGroupService.ts            ✅ Group business logic
│   │   └── AdminLessonService.ts           ✅ Lesson business logic
│   │
│   └── user/
│       ├── StudentService.ts               ✅ Student queries
│       ├── TeacherService.ts               ✅ Teacher queries
│       ├── ScheduleService.ts              ✅ Schedule queries
│       └── AttendanceService.ts            ✅ Attendance operations
│
├── types/
│   ├── express.d.ts                        ✅ Express User type extension
│   └── ai.ts                               ✅ AI intent types
│
├── utils/
│   ├── responses.ts                        ✅ Consistent response format
│   └── weekday.ts                          ✅ Date/weekday utilities
│
├── app.ts                                  ✅ Express app configuration
└── server.ts                               ✅ Server entry point
```

---

## 🎯 API Endpoints Summary

### **🔐 Admin Routes** (`/api/admin/*`)

**Authentication:** JWT + ADMIN role

| Resource   | Endpoints | Methods                      |
| ---------- | --------- | ---------------------------- |
| Students   | 5         | GET, POST, PUT, DELETE       |
| Teachers   | 5         | GET, POST, PUT, DELETE       |
| Subjects   | 5         | GET, POST, PUT, DELETE       |
| Groups     | 5         | GET, POST, PUT, DELETE       |
| Schedule   | 5         | GET, POST, PUT, DELETE       |
| Lessons    | 5         | GET, POST, PUT, DELETE       |
| Attendance | 6         | GET, POST, PUT, DELETE, BULK |

**Total Admin Endpoints:** 36

---

### **👤 User Routes** (`/api/user/*`)

**Authentication:** JWT + STUDENT or TEACHER role

| Category   | Endpoint                                   | Role    |
| ---------- | ------------------------------------------ | ------- |
| Student    | GET `/student/me/schedule/today`           | STUDENT |
| Student    | GET `/student/me/attendance`               | STUDENT |
| Teacher    | GET `/teacher/me/lessons/today`            | TEACHER |
| Teacher    | GET `/teacher/me/groups/:groupId/schedule` | TEACHER |
| Schedule   | GET `/schedule?weekday=MON`                | BOTH    |
| Attendance | POST `/attendance/mark`                    | TEACHER |
| Attendance | GET `/attendance/lesson/:lessonId`         | TEACHER |

**Total User Endpoints:** 7

---

### **🤖 AI Routes** (`/api/ai/*`)

**Authentication:** JWT (any authenticated role)

| Endpoint   | Method | Description                               |
| ---------- | ------ | ----------------------------------------- |
| `/context` | GET    | Aggregated system context (authenticated) |
| `/search`  | GET    | Search data (**ADMIN-only**)              |
| `/chat`    | POST   | Natural language AI assistant             |

**AI Intents Supported:**

- `GET_TODAY_SCHEDULE` - Fetches today's schedule
- `GET_TODAY_LESSONS` - Fetches today's lessons (teachers)
- `GET_ATTENDANCE` - Fetches student attendance history
- `UNKNOWN` - Fallback response

**Total AI Endpoints:** 1

---

## 🏗️ Architecture Principles

✅ **Controller Pattern** - Thin HTTP layer, no business logic  
✅ **Service Layer** - All database operations and business logic  
✅ **Middleware Chain** - Auth → Role check → Controller  
✅ **Dependency Separation** - Services injected into controllers  
✅ **Type Safety** - Full TypeScript with Prisma-generated types  
✅ **Consistent Responses** - Uniform JSON response format  
✅ **Role-based Access** - Fine-grained permission control

---

## 📝 Response Format

### Success Response

```typescript
{
  success: true,
  message: string,
  data?: any
}
```

### Error Response

```typescript
{
  success: false,
  message: string
}
```

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Apply migrations + seed
npx prisma migrate deploy
npm run db:seed

# 4. Start development server
npm run dev
```

Server runs on: `http://localhost:3001`

---

## 🎓 Role Capabilities

### ADMIN

- ✅ Full CRUD on Students, Teachers, Subjects, Groups
- ✅ Manage Schedule entries
- ✅ Manage Lessons
- ✅ Manage Attendance (including bulk operations)
- ✅ View all statistics

### STUDENT

- ✅ View own schedule
- ✅ View own attendance history
- ✅ Use AI assistant for queries

### TEACHER

- ✅ View today's lessons
- ✅ Mark attendance for students
- ✅ View group schedules
- ✅ Use AI assistant for queries

---

## ✅ Deliverables Checklist

- [x] `app.ts` - Express application setup
- [x] `server.ts` - Server entry point
- [x] `auth.middleware.ts` - JWT authentication
- [x] `role.middleware.ts` - Role-based authorization
- [x] `AdminStudentController.ts` - Admin student CRUD
- [x] `AdminTeacherController.ts` - Admin teacher CRUD
- [x] `AdminScheduleController.ts` - Admin schedule CRUD
- [x] `AdminAttendanceController.ts` - Admin attendance CRUD
- [x] `AdminSubjectController.ts` - Admin subject CRUD
- [x] `AdminGroupController.ts` - Admin group CRUD
- [x] `AdminLessonController.ts` - Admin lesson CRUD
- [x] `StudentController.ts` - Student endpoints
- [x] `TeacherController.ts` - Teacher endpoints
- [x] `ScheduleController.ts` - Schedule viewing
- [x] `AttendanceController.ts` - Attendance operations
- [x] `AiController.ts` - AI assistant with intent detection
- [x] All corresponding services (14 total)
- [x] Route wiring (admin, user, ai)
- [x] TypeScript compilation ✓
- [x] README documentation

---

**Status:** ✅ TypeScript compiles; DB + Prisma sync is migration-based.

See `PRODUCTION_READY_GUIDE.md` for reset/seed/smoke-test workflow.

# UniFlow Auth System - Test Guide

## ✅ System Status

### Backend (Port 3001)

- ✅ Running successfully
- ✅ CORS configured correctly
- ✅ Auth endpoints ready

### Frontend (Port 3003)

- ✅ Running successfully
- ⚠️ Note: Running on port 3003 (3000-3002 are in use)

## 🔐 Auth Endpoints

### 1. Signup (Ro'yxatdan o'tish)

**Endpoint:** `POST http://localhost:3001/api/auth/signup`

**Student uchun:**

```json
{
  "email": "student@uniflow.uz",
  "password": "test123",
  "fullName": "Abbos Abdullayev",
  "role": "STUDENT",
  "studentNo": "2024001"
}
```

**Teacher uchun:**

```json
{
  "email": "teacher@uniflow.uz",
  "password": "test123",
  "fullName": "Malika Karimova",
  "role": "TEACHER",
  "staffNo": "T2024001"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Signup successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "student@uniflow.uz",
      "role": "STUDENT",
      "fullName": "Abbos Abdullayev",
      "studentNo": "2024001"
    }
  }
}
```

### 2. Login (Kirish)

**Endpoint:** `POST http://localhost:3001/api/auth/login`

```json
{
  "email": "student@uniflow.uz",
  "password": "test123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "student@uniflow.uz",
      "role": "STUDENT",
      "fullName": "Abbos Abdullayev",
      "studentNo": "2024001"
    }
  }
}
```

### 3. Get Current User

**Endpoint:** `GET http://localhost:3001/api/auth/me`

**Headers:**

```
Authorization: Bearer <token>
```

## 🌐 Frontend Pages

### Login Page

- English: http://localhost:3003/en/login
- Uzbek: http://localhost:3003/uz/login

**Xususiyatlar:**

- Email va password input
- Form validation
- Error messages
- Loading state
- Automatic redirect to dashboard after login
- JWT token localStorage ga saqlanadi

### Signup Page

- English: http://localhost:3003/en/signup
- Uzbek: http://localhost:3003/uz/signup

**Xususiyatlar:**

- Full name, email, password inputs
- Role selection (Student/Teacher)
- Student Number yoki Staff Number (role ga qarab)
- Password confirmation
- Form validation
- Automatic user creation
- Auto-login after signup

### Dashboard (Protected)

- English: http://localhost:3003/en/dashboard
- Uzbek: http://localhost:3003/uz/dashboard

**Protection:** Token yo'q bo'lsa avtomatik `/login` ga redirect qiladi

## 🧪 Test Qilish

### 1. Curl bilan test

**Signup:**

```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@uniflow.uz",
    "password": "test123",
    "fullName": "Test User",
    "role": "STUDENT",
    "studentNo": "2024999"
  }'
```

**Login:**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@uniflow.uz",
    "password": "test123"
  }'
```

**Get User:**

```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 2. Browser da test

1. **Signup sahifasini oching:**
   - http://localhost:3003/en/signup
2. **Formani to'ldiring:**
   - Full Name: Test User
   - Email: test@uniflow.uz
   - Role: Student
   - Student Number: 2024999
   - Password: test123
   - Confirm Password: test123

3. **"Create account" tugmasini bosing**
   - Muvaffaqiyatli bo'lsa dashboard ga o'tadi
   - Token localStorage ga saqlanadi

4. **Logout qiling (header dan)** va qaytadan login qiling:
   - http://localhost:3003/en/login
   - Email: test@uniflow.uz
   - Password: test123

## 🔒 Security Notes

**⚠️ MUHIM: Demo rejimi**

Hozircha password hashing yo'q. Production uchun:

1. Install bcrypt:

```bash
cd backend
npm install bcrypt
npm install --save-dev @types/bcrypt
```

2. Update AuthController:

```typescript
import bcrypt from "bcrypt";

// Hash password during signup
const passwordHash = await bcrypt.hash(password, 10);

// Verify during login
if (
  !user.passwordHash ||
  !(await bcrypt.compare(password, user.passwordHash))
) {
  return fail(res, 401, "Invalid credentials");
}
```

## 📝 CORS Configuration

Backend'da CORS to'g'ri sozlangan:

```typescript
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003", // Admin port
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

## 🎯 Next Steps

1. ✅ Backend auth endpoints - WORKING
2. ✅ Frontend login/signup pages - WORKING
3. ✅ CORS - WORKING
4. ✅ JWT token storage - WORKING
5. ✅ Protected routes - WORKING
6. ⏳ Password hashing - TODO (bcrypt)
7. ⏳ Email verification - TODO
8. ⏳ Password reset - TODO
9. ⏳ Remember me - TODO
10. ⏳ Session management - TODO

## 🚀 Ready to Use!

Sistema to'liq ishlayapti. Foydalanish uchun:

1. Backend: http://localhost:3001
2. Frontend: http://localhost:3003
3. Login: /en/login yoki /uz/login
4. Signup: /en/signup yoki /uz/signup

export interface User {
  id: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "STAFF" | "MANAGER" | "ADMIN";
  fullName?: string;
  studentNo?: string;
  staffNo?: string;
  permissions: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
  role: "STUDENT" | "TEACHER" | "STAFF" | "MANAGER";
  studentNo?: string;
  staffNo?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

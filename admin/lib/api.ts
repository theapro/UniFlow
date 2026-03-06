import axios from "./axios";
import type {
  LoginRequest,
  SignupRequest,
  AuthResponse,
} from "@/types/auth.types";

// Authentication API
export const authApi = {
  login: (data: LoginRequest) =>
    axios.post<AuthResponse>("/api/auth/login", data),

  signup: (data: SignupRequest) =>
    axios.post<AuthResponse>("/api/auth/signup", data),

  verify: () => axios.get("/api/admin/verify"),

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Also clear cookie used by Next.js middleware
      document.cookie = "token=; Max-Age=0; Path=/; SameSite=Lax; Secure";
    }
  },

  getStoredToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  },

  getStoredUser: () => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    }
    return null;
  },

  storeAuth: (token: string, user: any) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Next.js middleware can only read cookies (not localStorage)
      // Set cookie with proper security attributes
      const maxAge = 7 * 24 * 60 * 60; // 7 days
      document.cookie = `token=${encodeURIComponent(
        token,
      )}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
    }
  },
};

export const studentsApi = {
  list: (params?: {
    q?: string;
    groupId?: string;
    take?: number;
    skip?: number;
  }) => axios.get("/api/admin/students", { params }),

  getById: (id: string) => axios.get(`/api/admin/students/${id}`),

  create: (data: any) => axios.post("/api/admin/students", data),

  update: (id: string, data: any) =>
    axios.put(`/api/admin/students/${id}`, data),

  resendCredentials: (id: string) =>
    axios.post(`/api/admin/students/${id}/resend-credentials`),

  remove: (id: string) => axios.delete(`/api/admin/students/${id}`),
};

export const teachersApi = {
  list: (params?: { q?: string; take?: number; skip?: number }) =>
    axios.get("/api/admin/teachers", { params }),

  getById: (id: string) => axios.get(`/api/admin/teachers/${id}`),

  create: (data: any) => axios.post("/api/admin/teachers", data),

  update: (id: string, data: any) =>
    axios.put(`/api/admin/teachers/${id}`, data),

  resendCredentials: (id: string) =>
    axios.post(`/api/admin/teachers/${id}/resend-credentials`),

  remove: (id: string) => axios.delete(`/api/admin/teachers/${id}`),
};

export const subjectsApi = {
  list: (params?: { q?: string; take?: number; skip?: number }) =>
    axios.get("/api/admin/subjects", { params }),

  getById: (id: string) => axios.get(`/api/admin/subjects/${id}`),

  create: (data: any) => axios.post("/api/admin/subjects", data),

  update: (id: string, data: any) =>
    axios.put(`/api/admin/subjects/${id}`, data),

  remove: (id: string) => axios.delete(`/api/admin/subjects/${id}`),
};

export const groupsApi = {
  list: (params?: { q?: string; take?: number; skip?: number }) =>
    axios.get("/api/admin/groups", { params }),

  getById: (id: string) => axios.get(`/api/admin/groups/${id}`),

  create: (data: any) => axios.post("/api/admin/groups", data),

  update: (id: string, data: any) => axios.put(`/api/admin/groups/${id}`, data),

  remove: (id: string) => axios.delete(`/api/admin/groups/${id}`),
};

export const scheduleApi = {
  list: (params?: {
    groupId?: string;
    teacherId?: string;
    take?: number;
    skip?: number;
  }) => axios.get("/api/admin/schedule", { params }),

  getById: (id: string) => axios.get(`/api/admin/schedule/${id}`),

  create: (data: any) => axios.post("/api/admin/schedule", data),

  update: (id: string, data: any) =>
    axios.put(`/api/admin/schedule/${id}`, data),

  remove: (id: string) => axios.delete(`/api/admin/schedule/${id}`),
};

export const lessonsApi = {
  list: (params?: {
    groupId?: string;
    teacherId?: string;
    from?: string;
    to?: string;
    take?: number;
    skip?: number;
  }) => axios.get("/api/admin/lessons", { params }),

  getById: (id: string) => axios.get(`/api/admin/lessons/${id}`),

  create: (data: any) => axios.post("/api/admin/lessons", data),

  update: (id: string, data: any) =>
    axios.put(`/api/admin/lessons/${id}`, data),

  remove: (id: string) => axios.delete(`/api/admin/lessons/${id}`),
};

export const attendanceApi = {
  list: (params?: {
    lessonId?: string;
    studentId?: string;
    take?: number;
    skip?: number;
  }) => axios.get("/api/admin/attendance", { params }),

  getById: (id: string) => axios.get(`/api/admin/attendance/${id}`),

  create: (data: any) => axios.post("/api/admin/attendance", data),

  bulkMark: (data: any) => axios.post("/api/admin/attendance/bulk", data),

  update: (id: string, data: any) =>
    axios.put(`/api/admin/attendance/${id}`, data),

  remove: (id: string) => axios.delete(`/api/admin/attendance/${id}`),
};

export const aiModelsApi = {
  list: () => axios.get("/api/admin/ai/models"),
  update: (id: string, patch: any) =>
    axios.patch(`/api/admin/ai/models/${id}`, patch),
};

export const sheetsApi = {
  health: () => axios.get("/api/admin/students-sheets/health"),
  status: () => axios.get("/api/admin/students-sheets/status"),
  syncNow: () => axios.post("/api/admin/students-sheets/sync"),
  conflicts: {
    list: (params?: {
      status?: "OPEN" | "RESOLVED";
      take?: number;
      skip?: number;
    }) => axios.get("/api/admin/students-sheets/conflicts", { params }),
    getById: (id: string) =>
      axios.get(`/api/admin/students-sheets/conflicts/${id}`),
    resolve: (id: string, data: any) =>
      axios.post(`/api/admin/students-sheets/conflicts/${id}/resolve`, data),
  },
};

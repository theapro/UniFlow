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
      document.cookie = "token=; Max-Age=0; Path=/; SameSite=Lax";
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

export const cohortsApi = {
  list: (params?: { q?: string; take?: number; skip?: number }) =>
    axios.get("/api/admin/cohorts", { params }),

  getById: (id: string) => axios.get(`/api/admin/cohorts/${id}`),

  create: (data: {
    code: string;
    sortOrder?: number | null;
    year?: number | null;
  }) => axios.post("/api/admin/cohorts", data),

  update: (
    id: string,
    patch: { code?: string; sortOrder?: number | null; year?: number | null },
  ) => axios.put(`/api/admin/cohorts/${id}`, patch),

  remove: (id: string) => axios.delete(`/api/admin/cohorts/${id}`),
};

export const parentGroupsApi = {
  list: (params?: { q?: string; take?: number; skip?: number }) =>
    axios.get("/api/admin/parent-groups", { params }),

  getById: (id: string) => axios.get(`/api/admin/parent-groups/${id}`),

  create: (data: { name: string }) =>
    axios.post("/api/admin/parent-groups", data),

  update: (id: string, data: { name: string }) =>
    axios.put(`/api/admin/parent-groups/${id}`, data),

  remove: (id: string) => axios.delete(`/api/admin/parent-groups/${id}`),
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

export const monthlyScheduleApi = {
  months: () => axios.get("/api/admin/monthly-schedule/months"),

  list: (params: {
    month: number;
    year: number;
    groupId?: string;
    teacherId?: string;
  }) => axios.get("/api/admin/monthly-schedule", { params }),

  create: (data: {
    date: string;
    timeSlotId: string;
    groupId: string;
    teacherId: string;
    subjectId: string;
    roomId?: string | null;
    note?: string | null;
  }) => axios.post("/api/admin/monthly-schedule", data),

  update: (
    id: string,
    patch: {
      date?: string;
      timeSlotId?: string;
      groupId?: string;
      teacherId?: string;
      subjectId?: string;
      roomId?: string | null;
      note?: string | null;
    },
  ) => axios.put(`/api/admin/monthly-schedule/${id}`, patch),

  remove: (id: string) => axios.delete(`/api/admin/monthly-schedule/${id}`),
};

export const aiScheduleApi = {
  generate: (data: {
    month: number;
    year: number;
    // New structured input
    requirements?: Array<{
      groupId: string;
      subjectId: string;
      teacherId: string;
      roomId?: string | null;
      lessons: number;
    }>;
    notes?: string;
    workingDays?: number[];

    // Legacy input (still accepted by backend)
    rules?: Array<{
      groupId: string;
      subjectId: string;
      teacherId: string;
      roomId?: string | null;
      lessons: number;
      note?: string | null;
    }>;
    holidays?: string[];
    teacherUnavailable?: Array<{
      teacherId: string;
      date: string;
      timeSlotId: string;
    }>;
    maxSeconds?: number;
  }) => axios.post("/api/admin/ai-schedule/generate", data),
  oneTapGenerate: (data: {
    month: number;
    year: number;
    cohortId?: string;
    workingDays?: number[];
    holidays?: string[];
    notes?: string;
    maxSeconds?: number;
  }) => axios.post("/api/admin/ai-schedule/one-tap-generate", data),
};

export const aiGroupsApi = {
  arrange: (data?: { maxColumns?: number }) =>
    axios.post("/api/admin/ai-groups/arrange", data ?? {}),
};

export const roomsApi = {
  list: (params?: { q?: string; take?: number; skip?: number }) =>
    axios.get("/api/admin/rooms", { params }),

  getById: (id: string) => axios.get(`/api/admin/rooms/${id}`),

  create: (data: { name: string; capacity?: number | null }) =>
    axios.post("/api/admin/rooms", data),

  update: (id: string, patch: { name?: string; capacity?: number | null }) =>
    axios.put(`/api/admin/rooms/${id}`, patch),

  remove: (id: string) => axios.delete(`/api/admin/rooms/${id}`),
};

export const timeSlotsApi = {
  list: () => axios.get("/api/admin/time-slots"),
};

export const lessonsApi = {
  list: (params?: {
    groupId?: string;
    subjectId?: string;
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

  getByDate: (params: { groupId: string; subjectId: string; date: string }) =>
    axios.get("/api/admin/attendance/by-date", { params }),

  getById: (id: string) => axios.get(`/api/admin/attendance/${id}`),

  create: (data: any) => axios.post("/api/admin/attendance", data),

  bulkMark: (data: any) => axios.post("/api/admin/attendance/bulk", data),

  bulkMarkByDate: (data: any) =>
    axios.post("/api/admin/attendance/by-date/bulk", data),

  update: (id: string, data: any) =>
    axios.put(`/api/admin/attendance/${id}`, data),

  remove: (id: string) => axios.delete(`/api/admin/attendance/${id}`),
};

export const aiModelsApi = {
  list: () => axios.get("/api/admin/ai/models"),
  update: (id: string, patch: any) =>
    axios.patch(`/api/admin/ai/models/${id}`, patch),
};

export const aiAdminApi = {
  settings: {
    get: () => axios.get("/api/admin/ai/settings"),
    patch: (patch: any) => axios.patch("/api/admin/ai/settings", patch),
  },
  tools: {
    list: () => axios.get("/api/admin/ai/tools"),
    patch: (name: string, patch: any) =>
      axios.patch(`/api/admin/ai/tools/${encodeURIComponent(name)}`, patch),
  },
  logs: {
    list: (params?: { take?: number; cursor?: string | null }) =>
      axios.get("/api/admin/ai/logs", { params }),
  },
  debugTraces: {
    list: (params?: { take?: number; cursor?: string | null }) =>
      axios.get("/api/admin/ai/debug-traces", { params }),
  },
  testChat: (data: {
    message: string;
    asRole: "STUDENT" | "TEACHER";
    userId?: string | null;
    requestedModel?: string;
  }) => axios.post("/api/admin/ai/test-chat", data),
  testTool: (data: {
    tool: string;
    args: Record<string, unknown>;
    asRole: "STUDENT" | "TEACHER" | "ADMIN";
    userId?: string | null;
  }) => axios.post("/api/admin/ai/test-tool", data),
};

export const maintenanceApi = {
  purgeAllNonAdmin: (data: { confirm: string; syncSheets?: boolean }) =>
    axios.post("/api/admin/purge", data),
};

export const sheetsApi = {
  health: () => axios.get("/api/admin/students-sheets/health"),
  patchConfig: (data: { spreadsheetId: string | null }) =>
    axios.patch("/api/admin/students-sheets/config", data),
  status: () => axios.get("/api/admin/students-sheets/status"),
  syncNow: () => axios.post("/api/admin/students-sheets/sync"),
  groups: {
    status: () => axios.get("/api/admin/students-sheets/groups/status"),
    sync: () => axios.post("/api/admin/students-sheets/groups/sync"),
  },
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

export const teachersSheetsApi = {
  health: () => axios.get("/api/admin/teachers-sheets/health"),
  patchConfig: (data: { spreadsheetId: string | null }) =>
    axios.patch("/api/admin/teachers-sheets/config", data),
  status: () => axios.get("/api/admin/teachers-sheets/status"),
  syncNow: () => axios.post("/api/admin/teachers-sheets/sync"),
};

export const attendanceSheetsApi = {
  health: () => axios.get("/api/admin/attendance-sheets/health"),
  patchConfig: (data: { spreadsheetId: string | null }) =>
    axios.patch("/api/admin/attendance-sheets/config", data),
  status: () => axios.get("/api/admin/attendance-sheets/status"),
  syncNow: () => axios.post("/api/admin/attendance-sheets/sync"),
  tabs: () => axios.get("/api/admin/attendance-sheets/tabs"),
  createTab: (data: {
    groupId: string;
    subjectId: string;
    dates: string[];
    assignmentCount?: number;
  }) => axios.post("/api/admin/attendance-sheets/tabs", data),
  preview: (params: { sheetTitle: string; takeRows?: number }) =>
    axios.get("/api/admin/attendance-sheets/preview", { params }),
};

export const gradesSheetsApi = {
  health: () => axios.get("/api/admin/grades-sheets/health"),
  patchConfig: (data: { spreadsheetId: string | null }) =>
    axios.patch("/api/admin/grades-sheets/config", data),
  status: () => axios.get("/api/admin/grades-sheets/status"),
  syncNow: () => axios.post("/api/admin/grades-sheets/sync"),
  forceSyncNow: () => axios.post("/api/admin/grades-sheets/force-sync"),
  tabs: () => axios.get("/api/admin/grades-sheets/tabs"),
  preview: (params: { sheetTitle: string; takeRows?: number }) =>
    axios.get("/api/admin/grades-sheets/preview", { params }),
  updateTab: (data: {
    sheetTitle: string;
    assignmentCount?: number;
    gradeValues?: string[][];
    gradeStartRowNumber?: number;
  }) => axios.post("/api/admin/grades-sheets/update", data),
};

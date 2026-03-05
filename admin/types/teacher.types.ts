export interface Teacher {
  id: string;
  fullName: string;
  staffNo: string | null;
  departmentId: string | null;
  user?: {
    email: string;
    lastLoginAt?: string | null;
    credentialsSentAt?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateTeacherInput {
  fullName: string;
  email?: string;
  staffNo?: string | null;
  departmentId?: string | null;
}

export interface UpdateTeacherInput {
  fullName?: string;
  email?: string;
  staffNo?: string | null;
  departmentId?: string | null;
}

export interface Teacher {
  id: string;
  fullName: string;
  staffNo: string | null;
  departmentId: string | null;
  email?: string | null;
  phone?: string | null;
  telegram?: string | null;
  note?: string | null;
  sheetCreatedAt?: string | null;
  sheetUpdatedAt?: string | null;
  subjects?: Array<{ id: string; name: string }>;
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
  phone?: string | null;
  telegram?: string | null;
  note?: string | null;
  subjectIds: string[];
}

export interface UpdateTeacherInput {
  fullName?: string;
  email?: string;
  staffNo?: string | null;
  departmentId?: string | null;
  phone?: string | null;
  telegram?: string | null;
  note?: string | null;
  subjectIds?: string[];
}

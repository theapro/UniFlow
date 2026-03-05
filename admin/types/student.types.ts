export interface Student {
  id: string;
  fullName: string;
  studentNo: string | null;
  groupId: string | null;
  user?: {
    email: string;
    lastLoginAt?: string | null;
    credentialsSentAt?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  group?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateStudentInput {
  fullName: string;
  email: string;
  studentNo?: string | null;
  groupId?: string | null;
}

export interface UpdateStudentInput {
  fullName?: string;
  email?: string;
  studentNo?: string | null;
  groupId?: string | null;
}

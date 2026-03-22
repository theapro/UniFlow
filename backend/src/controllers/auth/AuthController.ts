import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { ok, fail } from "../../utils/responses";
import jwt, { type SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { OAuth2Client } from "google-auth-library";
import { ResendEmailService } from "../../services/email/ResendEmailService";
import { Role } from "@prisma/client";

const LOGIN_CODE_EXPIRES_MINUTES = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateLoginCode() {
  // 6-digit numeric code
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

function buildUserData(user: {
  id: string;
  email: string;
  role: Role;
  student?: { fullName: string; studentNumber: string | null } | null;
  teacher?: { fullName: string; staffNo: string | null } | null;
}) {
  const userData: any = {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: [] as string[],
  };

  if (user.student) {
    userData.fullName = user.student.fullName;
    // Keep the outward API contract stable.
    userData.studentNo = user.student.studentNumber;
  } else if (user.teacher) {
    userData.fullName = user.teacher.fullName;
    userData.staffNo = user.teacher.staffNo;
  }

  return userData;
}

async function listPermissionsForRole(role: Role): Promise<string[]> {
  if (role === Role.ADMIN) {
    const all = await prisma.permission.findMany({ select: { name: true } });
    return all.map((p) => p.name);
  }

  const rows = await prisma.rolePermission.findMany({
    where: { role },
    select: { permission: true },
  });

  return rows.map((r) => r.permission);
}

export class AuthController {
  // Login
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return fail(res, 400, "Email and password are required");
      }

      // For demo purposes, we're doing simple password check
      // In production, use proper password hashing (bcrypt)

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          student: true,
          teacher: true,
        },
      });

      if (!user) {
        return fail(res, 401, "Invalid credentials");
      }

      // Verify password with bcrypt
      if (
        !user.passwordHash ||
        !bcrypt.compareSync(password, user.passwordHash)
      ) {
        return fail(res, 401, "Invalid credentials");
      }

      const userData = buildUserData(user);
      userData.permissions = await listPermissionsForRole(user.role);

      // Generate JWT token
      const token = jwt.sign({ userId: userData.id }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
      });

      // Track successful login
      await prisma.user.update({
        where: { id: userData.id },
        data: { lastLoginAt: new Date() },
      });

      return ok(res, "Login successful", {
        token,
        user: userData,
      });
    } catch (error) {
      console.error("Login error:", error);
      return fail(res, 500, "Internal server error");
    }
  }

  // Google Login (Sign-in with Google)
  static async googleLogin(req: Request, res: Response) {
    try {
      const { idToken, accessToken } = req.body ?? {};

      const hasIdToken = typeof idToken === "string" && idToken.length > 0;
      const hasAccessToken =
        typeof accessToken === "string" && accessToken.length > 0;

      if (!hasIdToken && !hasAccessToken) {
        return fail(res, 400, "idToken or accessToken is required");
      }

      let email: string | undefined;
      let emailVerified: boolean | undefined;

      if (hasIdToken) {
        if (!env.googleClientId) {
          return fail(res, 500, "GOOGLE_CLIENT_ID is not configured");
        }

        const client = new OAuth2Client(env.googleClientId);
        const ticket = await client.verifyIdToken({
          idToken,
          audience: env.googleClientId,
        });

        const payload = ticket.getPayload();
        email = payload?.email;
        emailVerified = payload?.email_verified;
      } else if (hasAccessToken) {
        // Support OAuth access tokens (e.g. @react-oauth/google useGoogleLogin)
        const userInfoResp = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!userInfoResp.ok) {
          return fail(res, 401, "Invalid Google access token");
        }

        const userInfo: any = await userInfoResp.json();
        email = userInfo?.email;
        emailVerified =
          userInfo?.email_verified ?? userInfo?.verified_email ?? undefined;
      }

      if (!email || typeof email !== "string") {
        return fail(res, 401, "Google token is missing email");
      }
      if (emailVerified === false) {
        return fail(res, 401, "Google email is not verified");
      }

      // Only allow login if user already exists in DB (created by admin)
      const user = await prisma.user.findUnique({
        where: { email },
        include: { student: true, teacher: true },
      });

      if (!user) {
        return fail(
          res,
          403,
          "This email is not registered. Please contact your administrator.",
        );
      }

      const userData = buildUserData(user);
      userData.permissions = await listPermissionsForRole(user.role);
      const token = jwt.sign({ userId: userData.id }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
      });

      // Track successful login
      await prisma.user.update({
        where: { id: userData.id },
        data: { lastLoginAt: new Date() },
      });

      return ok(res, "Login successful", {
        token,
        user: userData,
      });
    } catch (error) {
      console.error("Google login error:", error);
      return fail(res, 500, "Internal server error");
    }
  }

  // Request login code (email OTP)
  static async requestLoginCode(req: Request, res: Response) {
    try {
      const rawEmail = req.body?.email;
      if (!rawEmail || typeof rawEmail !== "string") {
        return fail(res, 400, "email is required");
      }

      const email = normalizeEmail(rawEmail);

      const user = await prisma.user.findUnique({
        where: { email },
        include: { student: true, teacher: true },
      });

      if (!user) {
        return fail(
          res,
          403,
          "This email is not registered. Please contact your administrator.",
        );
      }

      if (!env.resendApiKey) {
        return fail(res, 500, "RESEND_API_KEY is not configured");
      }

      const code = generateLoginCode();
      const codeHash = bcrypt.hashSync(code, 10);
      const expiresAt = new Date(
        Date.now() + LOGIN_CODE_EXPIRES_MINUTES * 60 * 1000,
      );

      // Invalidate previous unused codes for this user
      await prisma.loginCode.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await prisma.loginCode.create({
        data: {
          userId: user.id,
          codeHash,
          expiresAt,
        },
      });

      const mailer = new ResendEmailService();
      const userData = buildUserData(user);
      userData.permissions = await listPermissionsForRole(user.role);
      await mailer.sendLoginCode({
        to: user.email,
        fullName: userData.fullName ?? null,
        code,
        expiresInMinutes: LOGIN_CODE_EXPIRES_MINUTES,
      });

      return ok(res, "Login code sent", {
        expiresInMinutes: LOGIN_CODE_EXPIRES_MINUTES,
      });
    } catch (error) {
      const msg =
        typeof (error as any)?.message === "string"
          ? (error as any).message
          : "";
      console.error("Request login code error:", error);
      if (msg.includes("You can only send testing emails")) {
        return fail(
          res,
          500,
          "Resend is in testing mode: it can only email your own Resend account address. To send to Gmail/others, verify a domain in Resend and set RESEND_FROM_EMAIL to that domain.",
        );
      }
      if (msg.includes("domain is not verified")) {
        return fail(
          res,
          500,
          "Resend sender domain is not verified. Verify a domain in Resend and set RESEND_FROM_EMAIL to a verified sender.",
        );
      }
      return fail(res, 500, "Internal server error");
    }
  }

  // Verify login code
  static async verifyLoginCode(req: Request, res: Response) {
    try {
      const rawEmail = req.body?.email;
      const rawCode = req.body?.code;

      if (!rawEmail || typeof rawEmail !== "string") {
        return fail(res, 400, "email is required");
      }
      if (!rawCode || typeof rawCode !== "string") {
        return fail(res, 400, "code is required");
      }

      const email = normalizeEmail(rawEmail);
      const code = rawCode.trim();

      const user = await prisma.user.findUnique({
        where: { email },
        include: { student: true, teacher: true },
      });

      if (!user) {
        return fail(res, 401, "Invalid code");
      }

      const latest = await prisma.loginCode.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: "desc" },
      });

      if (!latest) {
        return fail(res, 401, "Invalid or expired code");
      }
      if (latest.expiresAt.getTime() < Date.now()) {
        await prisma.loginCode.update({
          where: { id: latest.id },
          data: { usedAt: new Date() },
        });
        return fail(res, 401, "Invalid or expired code");
      }

      const okCode = bcrypt.compareSync(code, latest.codeHash);
      if (!okCode) {
        return fail(res, 401, "Invalid or expired code");
      }

      await prisma.loginCode.update({
        where: { id: latest.id },
        data: { usedAt: new Date() },
      });

      // Track successful login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const userData = buildUserData(user);
      userData.permissions = await listPermissionsForRole(user.role);
      const token = jwt.sign({ userId: userData.id }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
      });

      return ok(res, "Login successful", {
        token,
        user: userData,
      });
    } catch (error) {
      console.error("Verify login code error:", error);
      return fail(res, 500, "Internal server error");
    }
  }

  // Signup
  static async signup(req: Request, res: Response) {
    return fail(
      res,
      403,
      "Signup is disabled. Please contact your administrator.",
    );

    try {
      const { email, password, fullName, role, studentNo, staffNo } = req.body;

      if (!email || !password || !fullName || !role) {
        return fail(res, 400, "All fields are required");
      }

      if (!["STUDENT", "TEACHER"].includes(role)) {
        return fail(res, 400, "Invalid role");
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return fail(res, 400, "User with this email already exists");
      }

      let newUser: any = null;
      let userData: any = null;

      if (role === "STUDENT") {
        // Create student and user
        const student = await prisma.student.create({
          data: {
            fullName,
            studentNumber: studentNo || `S${Date.now()}`,
          },
        });

        newUser = await prisma.user.create({
          data: {
            email,
            passwordHash: bcrypt.hashSync(password, 10),
            role: "STUDENT",
            studentId: student.id,
          },
          include: {
            student: true,
          },
        });

        userData = {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          fullName: student.fullName,
          studentNo: student.studentNumber,
        };
      } else if (role === "TEACHER") {
        // Create teacher and user
        const teacher = await prisma.teacher.create({
          data: {
            fullName,
            staffNo: staffNo || `T${Date.now()}`,
          },
        });

        newUser = await prisma.user.create({
          data: {
            email,
            passwordHash: bcrypt.hashSync(password, 10),
            role: "TEACHER",
            teacherId: teacher.id,
          },
          include: {
            teacher: true,
          },
        });

        userData = {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          fullName: teacher.fullName,
          staffNo: teacher.staffNo,
        };
      }

      // Generate JWT token
      const token = jwt.sign({ userId: userData.id }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
      });

      return ok(res, "Signup successful", {
        token,
        user: userData,
      });
    } catch (error) {
      console.error("Signup error:", error);
      return fail(res, 500, "Internal server error");
    }
  }

  // Get current user
  static async me(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return fail(res, 401, "Unauthorized");
      }

      return ok(res, "User retrieved successfully", user);
    } catch (error) {
      console.error("Get user error:", error);
      return fail(res, 500, "Internal server error");
    }
  }
}

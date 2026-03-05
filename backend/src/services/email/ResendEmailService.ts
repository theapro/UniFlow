import { Resend } from "resend";
import { env } from "../../config/env";

export type SendLoginCredentialsParams = {
  to: string;
  fullName?: string | null;
  password: string;
  loginUrl?: string;
};

export class ResendEmailService {
  private readonly resend: Resend;

  constructor() {
    if (!env.resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    this.resend = new Resend(env.resendApiKey);
  }

  async sendLoginCredentials(params: SendLoginCredentialsParams) {
    const primaryFrom = env.resendFromEmail?.trim();
    const fallbackFrom = "UniFlow <onboarding@resend.dev>";
    const from = primaryFrom || fallbackFrom;

    const loginUrl =
      params.loginUrl ?? env.userAppUrl ?? "http://localhost:3002/login";

    const safeName = params.fullName?.trim() || "";
    const greeting = safeName
      ? `Assalomu alaykum, ${safeName}!`
      : "Assalomu alaykum!";

    const subject = "UniFlow: Login ma'lumotlaringiz";

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
        <p>${greeting}</p>
        <p>Siz uchun UniFlow tizimida аккаунт yaratildi. Login ma'lumotlari:</p>
        <ul>
          <li><b>Email:</b> ${escapeHtml(params.to)}</li>
          <li><b>Password:</b> ${escapeHtml(params.password)}</li>
        </ul>
        <p><b>Login:</b> <a href="${loginUrl}">${loginUrl}</a></p>
        <p>Agar bu xabar sizga tegishli bo'lmasa, iltimos administratorga murojaat qiling.</p>
      </div>
    `;

    const sendOnce = async (sender: string) => {
      const { data, error } = await this.resend.emails.send({
        from: sender,
        to: params.to,
        subject,
        html,
      });
      if (error) {
        throw new Error(`RESEND_SEND_FAILED: ${error.message}`);
      }
      return data;
    };

    try {
      return await sendOnce(from);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "";
      if (
        primaryFrom &&
        primaryFrom !== fallbackFrom &&
        msg.includes("domain is not verified")
      ) {
        return await sendOnce(fallbackFrom);
      }
      throw e;
    }
  }

  async sendLoginCode(params: {
    to: string;
    fullName?: string | null;
    code: string;
    expiresInMinutes: number;
  }) {
    const primaryFrom = env.resendFromEmail?.trim();
    const fallbackFrom = "UniFlow <onboarding@resend.dev>";
    const from = primaryFrom || fallbackFrom;

    const safeName = params.fullName?.trim() || "";
    const greeting = safeName
      ? `Assalomu alaykum, ${safeName}!`
      : "Assalomu alaykum!";

    const subject = "UniFlow: Login kodi";
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
        <p>${greeting}</p>
        <p>UniFlow tizimiga kirish uchun login kodingiz:</p>
        <p style="font-size:20px;font-weight:700;letter-spacing:2px">${escapeHtml(
          params.code,
        )}</p>
        <p>Bu kod ${params.expiresInMinutes} daqiqa ichida amal qiladi.</p>
        <p>Agar bu siz bo'lmasangiz, iltimos bu xabarni e'tiborsiz qoldiring.</p>
      </div>
    `;

    const sendOnce = async (sender: string) => {
      const { data, error } = await this.resend.emails.send({
        from: sender,
        to: params.to,
        subject,
        html,
      });
      if (error) {
        throw new Error(`RESEND_SEND_FAILED: ${error.message}`);
      }
      return data;
    };

    try {
      return await sendOnce(from);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "";
      if (
        primaryFrom &&
        primaryFrom !== fallbackFrom &&
        msg.includes("domain is not verified")
      ) {
        return await sendOnce(fallbackFrom);
      }
      throw e;
    }
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

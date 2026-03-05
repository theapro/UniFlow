import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  // LLM / Groq (optional unless /api/ai/llm/chat is used)
  groqApiKey: optional("GROQ_API_KEY"),
  groqModel: optional("GROQ_MODEL"),
  groqApiUrl: optional("GROQ_API_URL"),
  aiContextLimit: Number(process.env.AI_CONTEXT_LIMIT ?? 15),
  aiMaxTokens: Number(process.env.AI_MAX_TOKENS ?? 2048),

  // Google Sign-In (ID token verification)
  googleClientId: optional("GOOGLE_CLIENT_ID"),

  // Email (Resend)
  resendApiKey: optional("RESEND_API_KEY"),
  resendFromEmail: optional("RESEND_FROM_EMAIL"),
  userAppUrl: optional("USER_APP_URL"),
};

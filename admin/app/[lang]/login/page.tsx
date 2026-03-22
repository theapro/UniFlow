"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Loader2, KeyRound, Mail, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError === "session_expired") {
      setError("Your session has expired. Please log in again.");
    } else if (urlError === "unauthorized") {
      setError("You are not authorized to access that page.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });

      if (response.data.success) {
        authApi.storeAuth(response.data.data.token, response.data.data.user);
        const from = searchParams.get("from");
        router.push(from && from.startsWith("/") ? from : `/${lang}/dashboard`);
      } else {
        setError(response.data.message || "Login failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#09090b] overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-[420px] px-6 animate-in fade-in zoom-in duration-700">
        <div className="space-y-8">
          {/* Login Card */}
          <div className="rounded-[32px] border border-white/5 bg-zinc-900/20 backdrop-blur-xl p-8 shadow-2xl">
          <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white/90">Uniflow Staff</h1>
          <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.3em] mt-2 font-semibold">
           
          </p>
        </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/60"
                  >
                    Institutional Email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@university.edu"
                      className="h-12 pl-11 rounded-2xl bg-white/[0.03] border-white/5 focus:border-primary/30 focus:ring-primary/20 transition-all text-sm font-medium"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label
                      htmlFor="password"
                      className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
                    >
                      Security Key
                    </Label>
                    <Link
                      href={`/${lang}/forgot-password`}
                      className="text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                    >
                      Recovery
                    </Link>
                  </div>
                  <div className="relative group">
                    <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="password"
                      type="password"
                      className="h-12 pl-11 rounded-2xl bg-white/[0.03] border-white/5 focus:border-primary/30 focus:ring-primary/20 transition-all text-sm font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 rounded-2xl bg-red-500/5 border border-red-500/10 p-4 animate-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-[11px] font-bold text-red-400/80 leading-tight uppercase tracking-tight">
                    {error}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    Authorize Access <ArrowRight size={14} />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-8 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="bg-white/5" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
                  <span className="bg-[#121214] px-4 text-muted-foreground/30">
                    SSO Options
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-bold uppercase tracking-widest transition-all"
                disabled
              >
                <svg className="mr-3 h-4 w-4 opacity-60" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[10px] font-medium text-muted-foreground/30 uppercase tracking-[0.1em]">
              Only for authorized personnel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

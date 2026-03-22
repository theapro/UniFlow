import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    // relative va overflow-hidden qo'shildi - bu fon elementlari sahifani cho'zib yubormasligi uchun
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#09090b] p-4 md:p-8 overflow-hidden">
      
      {/* Background Ornaments - pointer-events-none qo'shildi, ular tugmalarni to'sib qo'ymasligi uchun */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full opacity-50" />
      </div>

      {/* Konteyner o'lchami LoginForm o'lchami bilan bir xil qilindi */}
      <div className="relative z-10 w-full max-w-[440px] animate-in fade-in duration-1000">
        <Suspense fallback={
          <div className="h-[500px] w-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
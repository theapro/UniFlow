"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VoiceSpherePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/voice");
  }, [router]);

  return null;
}

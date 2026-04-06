"use client";

import { useRouter } from "next/navigation";

import type { ReceptionistInitData } from "../types";
import { ReceptionistChatSheet } from "./ReceptionistChatSheet";

export function ReceptionistChatOverlayClient(props: {
  closeHref: string;
  initialData: ReceptionistInitData | null;
  initialError: string | null;
}) {
  const { closeHref, initialData, initialError } = props;
  const router = useRouter();

  return (
    <ReceptionistChatSheet
      open={true}
      onOpenChange={(open) => {
        if (!open) router.push(closeHref);
      }}
      initialData={initialData}
      initialError={initialError}
    />
  );
}

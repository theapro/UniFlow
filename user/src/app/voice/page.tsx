import { redirect } from "next/navigation";

export default function VoicePage() {
  // Kept for compatibility with older links.
  // The voice experience lives inside the dashboard (sidebar layout).
  redirect("/dashboard/voice");
}

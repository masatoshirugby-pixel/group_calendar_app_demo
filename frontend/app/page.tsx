"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/Onboarding";

export default function Home() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("gcad_selected_groups");
    if (stored) {
      try {
        const groups: string[] = JSON.parse(stored);
        if (groups.length > 0) {
          const active = localStorage.getItem("gcad_active_group") ?? groups[0];
          router.replace(`/calendar?group=${encodeURIComponent(active)}`);
          return;
        }
      } catch {}
    }
    setShowOnboarding(true);
  }, [router]);

  if (!showOnboarding) {
    // リダイレクト待ち中は空白
    return null;
  }

  return <Onboarding />;
}

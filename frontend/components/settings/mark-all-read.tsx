"use client";

import { CheckCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="lg"
      className="h-9 px-3"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await supabaseBrowser()?.rpc("mark_notifications_read", { p_ids: null });
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all as read
    </Button>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { onFCMMessage } from "@/lib/fcm";
import NotificationToast from "@/components/NotificationToast";

interface ToastData {
  title: string;
  body: string;
  link?: string;
}

export default function ForegroundNotification() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [toast, setToast] = useState<ToastData | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!user) return;
    return onFCMMessage((payload: unknown) => {
      const p = payload as { data?: { title?: string; body?: string; link?: string } };
      const d = p.data;
      if (!d?.title) return;

      // Suppress if user is already on the target page
      if (d.link && pathname === d.link) return;

      setToast({ title: d.title, body: d.body || "", link: d.link });
    });
  }, [user, pathname]);

  return (
    <NotificationToast
      show={!!toast}
      title={toast?.title || ""}
      body={toast?.body || ""}
      link={toast?.link}
      onDismiss={dismiss}
    />
  );
}

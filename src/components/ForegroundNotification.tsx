"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { onFCMMessage } from "@/lib/fcm";
import NotificationToast from "@/components/NotificationToast";

export interface ToastData {
  title: string;
  body: string;
  link?: string;
  type?: "like" | "group_message" | "streak";
  icon?: string;
}

export default function ForegroundNotification() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [toast, setToast] = useState<ToastData | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!user) return;
    return onFCMMessage((payload: unknown) => {
      const p = payload as { data?: Record<string, string> };
      const d = p.data;
      if (!d?.title) return;

      // Suppress if user is already on the target page
      if (d.link && pathname === d.link) return;

      // Suppress on community tab for group messages (badges update in real-time)
      if (d.type === "group_message" && pathname === "/groups") return;

      // Vibrate
      if (navigator.vibrate) navigator.vibrate(80);

      setToast({
        title: d.title,
        body: d.body || "",
        link: d.link,
        type: (d.type as ToastData["type"]) || undefined,
        icon: d.icon || undefined,
      });
    });
  }, [user, pathname]);

  return (
    <NotificationToast
      show={!!toast}
      title={toast?.title || ""}
      body={toast?.body || ""}
      link={toast?.link}
      type={toast?.type}
      icon={toast?.icon}
      onDismiss={dismiss}
    />
  );
}

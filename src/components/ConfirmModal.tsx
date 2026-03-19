import { ReactNode } from "react";

interface ConfirmModalProps {
  title: string;
  message: string | ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmClass =
    confirmVariant === "danger"
      ? "bg-red-500 text-white"
      : "bg-gradient-to-br from-accent-orange to-accent-orange-dark text-white";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onCancel} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 card-material p-6 z-50 max-w-sm mx-auto">
        <p className={`text-center font-bold mb-1 ${confirmVariant === "danger" ? "text-red-500" : "text-forest"}`}>
          {title}
        </p>
        <div className="text-center text-sm text-gray-500 mb-5">{message}</div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-forest/20 text-forest py-2.5 rounded-full text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-full text-sm font-bold shadow-long ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

import { CircleCheck, CircleX, X } from "lucide-react";

export interface ToastMessage {
  kind: "success" | "error";
  text: string;
}

interface ToastProps {
  message: ToastMessage;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  const Icon = message.kind === "success" ? CircleCheck : CircleX;

  return (
    <div
      className={"toast toast--" + message.kind}
      role={message.kind === "error" ? "alert" : "status"}
    >
      <Icon size={19} aria-hidden="true" />
      <span>{message.text}</span>
      <button
        aria-label="Dismiss notification"
        className="toast-close"
        onClick={onClose}
        type="button"
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

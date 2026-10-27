import { useEffect, useRef, type MouseEvent, type SyntheticEvent } from "react";

interface ModalProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  titleId: string;
  placement?: "center" | "renewal";
}

export function Modal({
  children,
  open,
  onClose,
  titleId,
  placement = "center",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [open]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      className={"modal modal--" + placement}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}

"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function RecordDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="detail-backdrop"
      aria-labelledby="record-heading"
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}

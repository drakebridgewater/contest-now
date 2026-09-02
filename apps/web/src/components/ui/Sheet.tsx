import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Bottom sheet on phones, centered dialog on wider screens.
 * Uses a native <dialog> so Escape, focus trapping and the backdrop come for free.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label={title}
      className="m-0 mt-auto w-full max-w-xl rounded-t-2xl bg-surface p-0 backdrop:bg-black/40 sm:m-auto sm:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-target -mr-2 grid place-items-center rounded-lg text-ink-muted hover:bg-black/5"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto overscroll-contain p-4">{children}</div>
    </dialog>
  );
}

import React, { useEffect, useId, useRef } from 'react';

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const PortalDialog: React.FC<React.PropsWithChildren<{
  title: string;
  description?: string;
  onClose: () => void;
  size?: string;
  closeDisabled?: boolean;
  initialFocusSelector?: string;
}>> = ({
  title,
  description,
  onClose,
  size = 'max-w-2xl',
  closeDisabled = false,
  initialFocusSelector,
  children,
}) => {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const target = initialFocusSelector
      ? panel.current?.querySelector<HTMLElement>(initialFocusSelector)
      : panel.current?.querySelector<HTMLElement>(focusableSelector);
    target?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [initialFocusSelector]);

  const handleKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !closeDisabled) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) {
      event.preventDefault();
      panel.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brown-dark/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={closeDisabled || undefined} onKeyDown={handleKeys} className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-[#E4D6C9] bg-[#FAF7F2] p-5 shadow-2xl outline-none md:p-7 ${size}`}>
        <div className="flex items-start gap-4">
          <div><h2 id={titleId} className="font-serif text-2xl font-semibold text-brown-dark">{title}</h2>{description && <p id={descriptionId} className="mt-2 text-sm leading-6 text-brown-soft">{description}</p>}</div>
          <button type="button" disabled={closeDisabled} onClick={onClose} className="ml-auto rounded-lg p-2 text-xl leading-none text-brown-soft hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] disabled:opacity-40" aria-label="Close dialog">×</button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
};

export default PortalDialog;

import React from 'react';

export const inputClass = 'mt-2 w-full rounded-xl border border-[#D9C9BB] bg-white px-3.5 py-3 text-[15px] text-brown-dark outline-none transition placeholder:text-taupe focus:border-[#9B5B43] focus:ring-2 focus:ring-[#B76243]/20 disabled:bg-[#F7F1EA] disabled:text-brown-soft';

export const PortalCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <section className={`rounded-2xl border border-[#E5D8CB] bg-white p-5 shadow-[0_8px_30px_rgba(92,80,67,0.06)] md:p-7 ${className}`}>{children}</section>
);

export const Field: React.FC<React.PropsWithChildren<{
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
}>> = ({ label, htmlFor, hint, error, required, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-brown-dark">
      {label}{required && <span className="ml-1 text-[#A75035]" aria-hidden="true">*</span>}
    </label>
    {hint && <p id={`${htmlFor}-hint`} className="mt-1 text-sm leading-5 text-brown-soft">{hint}</p>}
    {children}
    {error && <p id={`${htmlFor}-error`} className="mt-1.5 text-sm text-[#A54236]" role="alert">{error}</p>}
  </div>
);

export const ErrorState: React.FC<{ message?: string; onRetry: () => void }> = ({ message = 'Something went wrong — please try again.', onRetry }) => (
  <PortalCard className="mx-auto max-w-xl text-center">
    <h2 className="font-serif text-2xl text-brown-dark">We couldn’t load this page</h2>
    <p className="mt-3 text-brown-soft">{message}</p>
    <button type="button" onClick={onRetry} className="mt-5 rounded-full bg-[#8C4F3A] px-5 py-2.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2">Try again</button>
  </PortalCard>
);

export const PageSkeleton: React.FC = () => (
  <div className="space-y-5" aria-label="Loading" role="status">
    <span className="sr-only">Loading your information</span>
    {[1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-sand bg-white/80"><div className="m-7 h-4 w-1/3 rounded bg-sand" /><div className="m-7 h-3 w-2/3 rounded bg-sand" /></div>)}
  </div>
);

export const Toast: React.FC<{ kind: 'success' | 'error' | 'info'; message: string; onClose?: () => void }> = ({ kind, message, onClose }) => {
  const styles = kind === 'success' ? 'border-[#A5B99A] bg-[#EEF4EA] text-[#3F5D3A]' : kind === 'error' ? 'border-[#D5A59C] bg-[#FFF0ED] text-[#8D352D]' : 'border-[#CFC5BA] bg-white text-brown-dark';
  return (
    <div className={`fixed bottom-24 right-4 z-[80] max-w-sm rounded-xl border px-4 py-3 shadow-lg md:bottom-5 ${styles}`} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite">
      <div className="flex items-start gap-3"><p className="text-sm font-medium">{message}</p>{onClose && <button type="button" onClick={onClose} className="ml-auto" aria-label="Dismiss notification">×</button>}</div>
    </div>
  );
};

export const Toggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, description, checked, disabled, onChange }) => (
  <div className="flex items-start justify-between gap-5 border-b border-sand py-4 last:border-0">
    <div><p className="font-medium text-brown-dark">{label}</p>{description && <p className="mt-1 text-sm leading-5 text-brown-soft">{description}</p>}</div>
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:opacity-50 ${checked ? 'bg-[#70866A]' : 'bg-[#C9BEB3]'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  </div>
);

export const ChoiceCards: React.FC<{
  name: string;
  value: string;
  options: Array<{ value: string; label: string; description?: string }>;
  onChange: (value: string) => void;
}> = ({ name, value, options, onChange }) => (
  <div className="grid gap-3" role="radiogroup">
    {options.map((option) => (
      <label key={option.value} className={`cursor-pointer rounded-xl border p-4 transition ${value === option.value ? 'border-[#9B5B43] bg-[#FBF2EC] ring-1 ring-[#9B5B43]' : 'border-[#DED2C6] bg-white hover:border-[#BFAEA0]'}`}>
        <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
        <span className="font-semibold text-brown-dark">{option.label}</span>
        {option.description && <span className="mt-1 block text-sm leading-5 text-brown-soft">{option.description}</span>}
      </label>
    ))}
  </div>
);

export const CheckboxGrid: React.FC<{
  name: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}> = ({ name, values, options, onChange }) => (
  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {options.map((option) => {
      const checked = values.includes(option);
      return <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm ${checked ? 'border-[#8B6F58] bg-[#F5EDE4] text-brown-dark' : 'border-[#DED2C6] bg-white text-brown-soft'}`}><input type="checkbox" name={name} checked={checked} onChange={() => onChange(checked ? values.filter((value) => value !== option) : [...values, option])} className="h-4 w-4 rounded border-taupe accent-[#70866A]" />{option}</label>;
    })}
  </div>
);

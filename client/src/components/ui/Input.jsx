export function Input({ label, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <input
        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}

export function Select({ label, error, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <select
        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}

export function Textarea({ label, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <textarea
        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}

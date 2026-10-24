export function Button({ children, variant = 'primary', className = '', disabled, ...props }) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-brand/50',
    dark: 'bg-navy text-white hover:bg-ink disabled:bg-navy/50',
    outline: 'border border-line bg-white text-ink hover:border-brand hover:text-brand disabled:opacity-50',
    ghost: 'text-ink hover:bg-soft disabled:opacity-50',
    danger: 'bg-error text-white hover:bg-error/90 disabled:opacity-50',
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed ${styles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-line/70 ${className}`} />;
}

export function Pagination({ page, perPage, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50">Previous</button>
      <span className="text-sm text-muted">Page {page} of {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50">Next</button>
    </nav>
  );
}

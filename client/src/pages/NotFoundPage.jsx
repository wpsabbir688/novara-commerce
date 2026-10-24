import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted">This page does not exist.</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-navy px-5 py-2.5 text-sm font-medium text-white">Back to home</Link>
    </div>
  );
}

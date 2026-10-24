import { useSearchParams } from 'react-router-dom';
import { ShopPage } from './ShopPage.jsx';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Results for “{q}”</p>
      <ShopPage key={q} />
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { frappeApi } from '../api/frappe';
import { allProducts, type Product } from '../data/allProducts';

const PAGE_SIZE = 20;

export function mapToProduct(item: any): Product {
  const rate = item.selling_price ?? item.standard_rate;
  return {
    id: item.name,
    name: item.item_name || item.name,
    price: item.price_range
      ? item.price_range
      : (rate != null && Number(rate) > 0 ? `₹${Number(rate).toLocaleString('en-IN')}` : '₹0'),
    image: item.image || item.website_image || item.thumbnail || '',
    images: Array.isArray(item.images) && item.images.length > 0 ? item.images : undefined,
    category: item.item_group || 'General',
    rating: 4.5,
    gender: item.gender || undefined,
    has_variants: Boolean(item.has_variants),
    price_range: item.price_range,
    variant_count: item.variant_count,
  };
}

export function useFrappeProducts(category?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [source, setSource] = useState<'frappe' | 'static'>('static');
  const [usingFrappe, setUsingFrappe] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOffset(0);
    setProducts([]);
    setHasMore(false);
    setUsingFrappe(false);

    (async () => {
      try {
        const res = await frappeApi.getProducts(category);
        if (cancelled) return;
        // Handle both old array response and new paginated response
        const raw = res.data;
        const itemsRaw = Array.isArray(raw) ? raw : (raw as any)?.items ?? [];
        const total = Array.isArray(raw) ? itemsRaw.length : ((raw as any)?.total ?? itemsRaw.length);

        if (itemsRaw.length > 0) {
          const mapped = itemsRaw.map(mapToProduct).filter((p: Product) => p.image || p.images?.length);
          setProducts(mapped);
          setHasMore(mapped.length < total);
          setOffset(itemsRaw.length);
          setSource('frappe');
          setUsingFrappe(true);
        } else {
          throw new Error('No products in Frappe');
        }
      } catch {
        if (cancelled) return;
        const filtered = category
          ? allProducts.filter(p => p.category.toLowerCase() === category.toLowerCase())
          : allProducts;
        setProducts(filtered);
        setHasMore(false);
        setSource('static');
        setUsingFrappe(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [category]);

  const loadMore = useCallback(async () => {
    if (!usingFrappe || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (category) params.set('item_group', category);
      const res = await fetch(
        `${BASE}/api/method/store_customizations.api.products.get_all_products?${params.toString()}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      const raw = json.message;
      const itemsRaw = Array.isArray(raw) ? raw : (raw?.items ?? []);
      const total = Array.isArray(raw) ? (offset + itemsRaw.length) : (raw?.total ?? offset + itemsRaw.length);
      if (itemsRaw.length > 0) {
        const mapped = itemsRaw.map(mapToProduct).filter((p: Product) => p.image || p.images?.length);
        setProducts(prev => [...prev, ...mapped]);
        const newOffset = offset + itemsRaw.length;
        setOffset(newOffset);
        setHasMore(newOffset < total);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [usingFrappe, loadingMore, hasMore, offset, category]);

  return { products, loading, loadingMore, hasMore, loadMore, source };
}

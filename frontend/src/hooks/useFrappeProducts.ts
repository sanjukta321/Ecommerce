import { useState, useEffect } from 'react';
import { frappeApi } from '../api/frappe';
import { allProducts, type Product } from '../data/allProducts';

function mapToProduct(item: any): Product {
  return {
    id: item.name,
    name: item.item_name || item.name,
    price: item.standard_rate
      ? `₹${Number(item.standard_rate).toLocaleString('en-IN')}`
      : '₹0',
    image: item.website_image || item.thumbnail
      || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600',
    category: item.item_group || 'General',
    rating: 4.5,
  };
}

export function useFrappeProducts(category?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'frappe' | 'static'>('static');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await frappeApi.getProducts(category);
        if (res.data && res.data.length > 0) {
          setProducts(res.data.map(mapToProduct));
          setSource('frappe');
        } else {
          throw new Error('No products in Frappe');
        }
      } catch {
        // Fallback to static data
        const filtered = category
          ? allProducts.filter(p => p.category.toLowerCase() === category.toLowerCase())
          : allProducts;
        setProducts(filtered);
        setSource('static');
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  return { products, loading, source };
}

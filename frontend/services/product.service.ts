/**
 * Product Service – orchestrates product CRUD, search, filtering.
 */
import { productsApi, type ProductListParams } from '@/lib/api/products';
import type { Product } from '@/types';
import { toast } from 'sonner';

export type { ProductListParams } from '@/lib/api/products';

class ProductService {
  async list(params?: ProductListParams): Promise<{ products: Product[]; total: number }> {
    try {
      const res = await productsApi.list(params);
      // Backend format is { success: true, data: [...], pagination: {...} }
      let products = res.data.data || res.data.products || res.data;

      // If products is not an array (e.g., an object or undefined), return empty array
      if (!Array.isArray(products)) {
        console.warn('Products API returned non-array data:', products);
        products = [];
      }

      return {
        products,
        total: res.data.total || products.length || 0,
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      return { products: [], total: 0 };
    }
  }

  async getById(id: number): Promise<Product | null> {
    try {
      const res = await productsApi.getById(id);
      return res.data.data || res.data.product || null;
    } catch {
      toast.error('Product not found');
      return null;
    }
  }

  async create(data: FormData): Promise<Product | null> {
    try {
      const res = await productsApi.create(data);
      toast.success('Product created successfully');
      return res.data.product || res.data;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create product');
      return null;
    }
  }

  async update(id: number, data: FormData): Promise<Product | null> {
    try {
      const res = await productsApi.update(id, data);
      toast.success('Product updated successfully');
      return res.data.product || res.data;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update product');
      return null;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await productsApi.delete(id);
      toast.success('Product deleted');
      return true;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete product');
      return false;
    }
  }
}

export const productService = new ProductService();


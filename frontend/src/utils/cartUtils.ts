import { Dispatch } from '@reduxjs/toolkit';
import { addToCartAsync } from '../store/thunks/cartThunks';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  _id?: string;
  title: string;
  name?: string;
  priceInUSD: number;
  price?: number;
  image?: string;
  images?: string[];
}

export const handleAddToCart = async (
  product: Product,
  dispatch: Dispatch,
  quantity: number = 1
) => {
  // Normalize product ID
  const productId = String(product._id || product.id).trim();
  
  if (!productId || productId === 'undefined' || productId === 'null') {
    toast.error('Invalid product data');
    console.error('Invalid product ID:', product.id);
    return;
  }

  const productName = product.title || product.name || 'Product';
  const productPrice = product.priceInUSD || product.price || 0;
  const productImage = product.images?.[0] || product.image || 'https://via.placeholder.com/400';

  if (!productName || productPrice <= 0) {
    toast.error('Invalid product data');
    return;
  }

  try {
    await dispatch(addToCartAsync({
      productId: productId,
      name: productName,
      price: productPrice,
      quantity: quantity,
      image: productImage,
    }) as any);
    
    toast.success(`${productName} added to cart!`);
  } catch (error: any) {
    toast.error(error.message || 'Failed to add to cart');
  }
};

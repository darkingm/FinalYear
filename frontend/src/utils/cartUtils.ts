import { Dispatch } from '@reduxjs/toolkit';
import { addToCart } from '../store/slices/cartSlice';
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

export const handleAddToCart = (
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

  dispatch(addToCart({
    id: productId,
    name: productName,
    price: productPrice,
    quantity: quantity,
    image: productImage,
  }));
  
  toast.success(`${productName} added to cart!`);
};

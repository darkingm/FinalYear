import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiPackage,
  FiTruck,
  FiCheckCircle,
  FiArrowLeft,
  FiMapPin,
  FiPhone,
  FiMail,
  FiCalendar
} from 'react-icons/fi';
import axios from '../../api/axios';
import toast from 'react-hot-toast';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  total: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  date: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  trackingNumber?: string;
  estimatedDelivery?: string;
}

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrderDetail();
    }
  }, [id]);

  const fetchOrderDetail = async () => {
    try {
      const response = await axios.get(`/api/v1/orders/${id}`);
      setOrder(response.data.data);
    } catch (error) {
      console.error('Error fetching order detail:', error);
      toast.error('Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { key: 'pending', label: 'Order Placed', icon: FiPackage },
      { key: 'processing', label: 'Processing', icon: FiPackage },
      { key: 'shipped', label: 'Shipped', icon: FiTruck },
      { key: 'delivered', label: 'Delivered', icon: FiCheckCircle },
    ];

    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(order?.status || 'pending');

    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      active: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Order not found
        </h2>
        <button
          onClick={() => navigate('/orders')}
          className="btn btn-primary"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const steps = getStatusSteps();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
          >
            <FiArrowLeft />
            <span>Back to Orders</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Order #{order.orderNumber}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Placed on {new Date(order.date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Order Status Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Order Status
          </h2>
          <div className="relative">
            <div className="flex justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center ${
                      step.completed
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${
                        step.completed
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {step.label}
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`absolute top-6 left-1/2 w-full h-0.5 ${
                        step.completed ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`} style={{ marginLeft: '50%' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {order.trackingNumber && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Tracking Number
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {order.trackingNumber}
                  </div>
                </div>
                {order.estimatedDelivery && (
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Estimated Delivery
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {new Date(order.estimatedDelivery).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Items */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Order Items
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <img
                    src={item.productImage}
                    alt={item.productName}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.productName}
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Quantity: {item.quantity} × ${item.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    ${item.total.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Shipping</span>
                  <span>${order.shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Tax</span>
                  <span>${order.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>Total</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Information */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Shipping Address
              </h2>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <FiMapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {order.shippingAddress.fullName}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {order.shippingAddress.address}<br />
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}<br />
                      {order.shippingAddress.country}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <FiPhone className="w-5 h-5 text-gray-400" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {order.shippingAddress.phone}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <FiMail className="w-5 h-5 text-gray-400" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {order.shippingAddress.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Need Help?
              </h2>
              <div className="space-y-3">
                <button className="w-full btn btn-outline">
                  Contact Support
                </button>
                <button className="w-full btn btn-outline">
                  Track Package
                </button>
                {order.status === 'delivered' && (
                  <button className="w-full btn btn-primary">
                    Leave a Review
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;


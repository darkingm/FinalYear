import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/home/HomeScreen';
import ProductListScreen from '../screens/products/ProductListScreen';
import ProductDetailScreen from '../screens/products/ProductDetailScreen';
import CartScreen from '../screens/cart/CartScreen';
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import OrdersScreen from '../screens/orders/OrdersScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import WalletScreen from '../screens/wallet/WalletScreen';
import P2PTradingScreen from '../screens/p2p/P2PTradingScreen';
import P2PTradeDetailScreen from '../screens/p2p/P2PTradeDetailScreen';
import CreateP2PListingScreen from '../screens/p2p/CreateP2PListingScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import ChatDetailScreen from '../screens/chat/ChatDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import VNPayPaymentScreen from '../screens/payment/VNPayPaymentScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductList" component={ProductListScreen} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} />
    <Stack.Screen name="VNPayPayment" component={VNPayPaymentScreen} options={{ headerShown: true, title: 'VNPay Payment' }} />
    <Stack.Screen name="P2PTradeDetail" component={P2PTradeDetailScreen} />
    <Stack.Screen name="CreateP2PListing" component={CreateP2PListingScreen} />
  </Stack.Navigator>
);

const OrdersStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="OrdersMain" component={OrdersScreen} options={{ headerShown: false }} />
    <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
  </Stack.Navigator>
);

const ChatStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ChatMain" component={ChatScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
  </Stack.Navigator>
);


const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#6B7280',
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Orders" component={OrdersStack} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="P2P" component={P2PTradingScreen} />
      <Tab.Screen name="Chat" component={ChatStack} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainNavigator;


import '../lib/i18n';
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import '../global.css';
import { useAuthStore } from '../lib/store/auth-store';
import { registerForPushNotificationsAsync, syncPushToken } from '../lib/services/notifications';

export default function RootLayout() {
  const loadFromStorage = useAuthStore(s => s.loadFromStorage);
  const { isAuthenticated } = useAuthStore();
  const notifListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Register push notifications after login
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotificationsAsync().then(token => {
      if (token) syncPushToken(token);
    });

    // Listener: notification received while app is open
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification.request.content.title);
    });

    // Listener: user tapped on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'order_status' && data?.orderId) {
        // Navigate to order - handled via expo-router
        console.log('Navigate to order:', data.orderId);
      }
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <SafeAreaProvider style={{ backgroundColor: '#0c0e14' }}>
        <StatusBar style="light" backgroundColor="#0c0e14" />
        <Stack screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0c0e14' },
          animation: 'slide_from_right',
        }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="auth/register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="products/[id]" />
          <Stack.Screen name="products/create" />
          <Stack.Screen name="products/nfc-verify" />
          <Stack.Screen name="orders/[id]" />
          <Stack.Screen name="orders/[id]/chat" />
          <Stack.Screen name="orders/review" />
          <Stack.Screen name="checkout/[orderId]" />
          <Stack.Screen name="profile/credit-score" />
          <Stack.Screen name="nft/[tokenId]" />
          <Stack.Screen name="leaderboard/index" />
          <Stack.Screen name="seller/flash-sale" />
          <Stack.Screen name="installment/[orderId]" />
          <Stack.Screen name="products/nearby" />
          <Stack.Screen name="chat" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

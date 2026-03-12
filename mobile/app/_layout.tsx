import '../lib/i18n';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';
import { useAuthStore } from '../lib/store/auth-store';

export default function RootLayout() {
  const loadFromStorage = useAuthStore(s => s.loadFromStorage);
  
  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth/register" options={{ presentation: 'modal' }} />
          <Stack.Screen name="products/[id]" />
          <Stack.Screen name="orders/[id]" />
          <Stack.Screen name="checkout/[orderId]" />
          <Stack.Screen name="chat" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

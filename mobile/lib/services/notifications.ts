import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Đơn hàng',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Khuyến mãi',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch {
    return null;
  }
}

// Register token with backend
export async function syncPushToken(token: string) {
  try {
    await apiClient.post('/api/users/push-token', { token, platform: Platform.OS });
  } catch {}
}

// Local notification helpers
export async function notifyOrderStatusChange(
  productName: string,
  status: string,
  orderId: number,
) {
  const messages: Record<string, { title: string; body: string; emoji: string }> = {
    PENDING:           { title: 'Đơn hàng đang xử lý', body: `${productName} — Seller đang chuẩn bị hàng`, emoji: '🔄' },
    ONCHAIN_CONFIRMED: { title: 'Đơn hàng được xác nhận', body: `${productName} — Đã xác nhận trên blockchain`, emoji: '⛓️' },
    DELIVERING:        { title: 'Hàng đang trên đường!', body: `${productName} — Đơn vị vận chuyển đang giao`, emoji: '🚚' },
    COMPLETED:         { title: '✅ Nhận hàng thành công!', body: `${productName} — +15 Credit Score được tích lũy`, emoji: '🎉' },
    CANCELLED:         { title: 'Đơn hàng bị huỷ', body: `${productName} — Tiền đã hoàn vào Escrow`, emoji: '❌' },
    DISPUTED:          { title: 'Tranh chấp đang xử lý', body: `${productName} — Đội hỗ trợ đang can thiệp`, emoji: '⚠️' },
  };

  const msg = messages[status];
  if (!msg) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${msg.emoji} ${msg.title}`,
      body: msg.body,
      data: { orderId, type: 'order_status' },
      sound: 'default',
    },
    trigger: null, // immediate
  });
}

export async function notifyPriceAlert(symbol: string, price: number, changePercent: number) {
  const dir = changePercent > 0 ? '📈' : '📉';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${dir} ${symbol} ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
      body: `Giá hiện tại: $${price.toLocaleString()}`,
      data: { type: 'price_alert', symbol },
    },
    trigger: null,
  });
}

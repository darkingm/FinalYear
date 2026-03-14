import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Send, Package, ShieldCheck, Info } from 'lucide-react-native';
import { apiClient } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/store/auth-store';

interface ChatMessage {
  message_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  created_at: string;
  is_system?: boolean;
}

interface OrderInfo {
  product_name: string;
  status: string;
  seller_name: string;
  primary_image: string | null;
}

export default function OrderChatScreen() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const [chatRes, orderRes] = await Promise.all([
        apiClient.get(`/api/orders/${orderId}/messages`),
        silent ? Promise.resolve(null) : apiClient.get(`/api/orders/${orderId}`),
      ]);
      setMessages(chatRes.data.messages ?? []);
      if (orderRes) {
        const o = orderRes.data.order ?? orderRes.data;
        setOrderInfo({
          product_name: o.product_name,
          status: o.status,
          seller_name: o.seller_name,
          primary_image: o.primary_image,
        });
      }
    } catch {}
    if (!silent) setLoading(false);
  }, [orderId]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(() => fetchMessages(true), 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setSending(true);

    // Optimistic update
    const optimistic: ChatMessage = {
      message_id: Date.now(),
      sender_id: user?.user_id ?? 0,
      sender_name: user?.username ?? 'You',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await apiClient.post(`/api/orders/${orderId}/messages`, { content: text });
      await fetchMessages(true);
    } catch {}
    setSending(false);
  };

  const isMine = (msg: ChatMessage) => msg.sender_id === user?.user_id;

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#f0b90b" size="large" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* ── Header ── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e2130', gap: 12,
      }}>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={17} color="#9ca3af" />
        </Pressable>

        {/* Avatar */}
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0b90b', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'black', fontWeight: '900', fontSize: 16 }}>
            {orderInfo?.seller_name?.charAt(0)?.toUpperCase() ?? 'S'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>
            {orderInfo?.seller_name ?? 'Seller'}
          </Text>
          <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '600' }}>● Online</Text>
        </View>

        <View style={{ backgroundColor: '#131722', borderRadius: 10, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 120 }}>
          <Package size={13} color="#6b7280" />
          <Text style={{ color: '#6b7280', fontSize: 11, maxWidth: 80 }} numberOfLines={1}>
            {orderInfo?.product_name}
          </Text>
        </View>
      </View>

      {/* ── Escrow Notice ── */}
      <View style={{ backgroundColor: 'rgba(16,185,129,0.06)', marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' }}>
        <ShieldCheck size={14} color="#10b981" />
        <Text style={{ color: '#6b7280', fontSize: 11, flex: 1 }}>
          Mọi cuộc trò chuyện được bảo vệ. Không chia sẻ thông tin cá nhân bên ngoài nền tảng.
        </Text>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => String(m.message_id)}
        contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <Info size={36} color="#374151" />
            <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
              Bắt đầu cuộc trò chuyện với Seller.{'\n'}Hỏi về tình trạng hàng, thời gian giao, v.v.
            </Text>
          </View>
        )}
        renderItem={({ item: msg }) => {
          const mine = isMine(msg);
          if (msg.is_system) return (
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
              <View style={{ backgroundColor: '#131722', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5 }}>
                <Text style={{ color: '#6b7280', fontSize: 11 }}>{msg.content}</Text>
              </View>
            </View>
          );
          return (
            <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
              {!mine && (
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0b90b', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Text style={{ color: 'black', fontWeight: '800', fontSize: 12 }}>
                    {msg.sender_name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ maxWidth: '72%' }}>
                {!mine && (
                  <Text style={{ color: '#6b7280', fontSize: 10, marginBottom: 3, marginLeft: 4 }}>{msg.sender_name}</Text>
                )}
                <View style={{
                  backgroundColor: mine ? '#f0b90b' : '#1e2130',
                  borderRadius: 18,
                  borderBottomLeftRadius: mine ? 18 : 4,
                  borderBottomRightRadius: mine ? 4 : 18,
                  paddingHorizontal: 14, paddingVertical: 10,
                }}>
                  <Text style={{ color: mine ? 'black' : 'white', fontSize: 14, lineHeight: 20, fontWeight: mine ? '600' : '400' }}>
                    {msg.content}
                  </Text>
                </View>
                <Text style={{
                  color: '#374151', fontSize: 10, marginTop: 3,
                  marginLeft: mine ? 0 : 4, textAlign: mine ? 'right' : 'left',
                }}>
                  {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* ── Input ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: 10,
          paddingHorizontal: 16, paddingVertical: 12,
          borderTopWidth: 1, borderTopColor: '#1e2130',
          backgroundColor: '#0c0e14',
        }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: '#131722', borderRadius: 24, borderWidth: 1,
              borderColor: input ? '#f0b90b30' : '#1e2130',
              color: 'white', paddingHorizontal: 16, paddingVertical: 12,
              fontSize: 14, maxHeight: 100,
            }}
            placeholder="Nhắn tin cho Seller..."
            placeholderTextColor="#374151"
            multiline
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
          />
          <Pressable
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: input.trim() ? '#f0b90b' : '#131722',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {sending ? (
              <ActivityIndicator color={input.trim() ? 'black' : '#374151'} size="small" />
            ) : (
              <Send size={18} color={input.trim() ? 'black' : '#374151'} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

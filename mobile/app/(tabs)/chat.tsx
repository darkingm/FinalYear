import { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../lib/store/auth-store';
import { useRouter } from 'expo-router';
import { apiClient } from '../../lib/api/client';
import { Send, Bot, User, LogIn } from 'lucide-react-native';
import { Link } from 'expo-router';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AI_SERVICE_URL = process.env.EXPO_PUBLIC_AI_URL || 'http://103.20.96.79:3005';

const QUICK_PROMPTS = [
  'ETH giá bao nhiêu hôm nay?',
  'Gợi ý sản phẩm dưới 100 USDT',
  'Quy trình thanh toán Escrow là gì?',
  'Làm thế nào để kết nối ví?',
];

export default function ChatScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: 'Xin chào! Tôi là AI Assistant của CryptoMarket 🤖\nTôi có thể giúp bạn:\n• Phân tích giá crypto\n• Gợi ý sản phẩm phù hợp\n• Giải đáp về thanh toán & ví\n\nBạn cần hỏi gì?',
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(ms => [...ms, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.message || 'Xin lỗi, tôi chưa hiểu câu hỏi này.';
      setMessages(ms => [...ms, { id: Date.now().toString() + 'a', role: 'assistant', content: reply, timestamp: new Date() }]);
    } catch {
      setMessages(ms => [...ms, { id: Date.now().toString() + 'e', role: 'assistant', content: 'Dịch vụ AI đang bảo trì. Vui lòng thử lại sau!', timestamp: new Date() }]);
    }
    setLoading(false);
    setTimeout(() => flatRef.current?.scrollToEnd(), 100);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0c0e14]">
      {/* Header */}
      <View className="px-4 py-4 border-b border-[#1e2130] flex-row items-center gap-3">
        <View className="w-10 h-10 bg-[#f0b90b] rounded-full items-center justify-center">
          <Bot size={20} color="black" />
        </View>
        <View>
          <Text className="text-white font-bold text-base">CryptoMarket AI</Text>
          <Text className="text-emerald-400 text-xs">● Online</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => flatRef.current?.scrollToEnd()}
        ListHeaderComponent={() => (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {QUICK_PROMPTS.map(p => (
              <Pressable key={p} onPress={() => sendMessage(p)} className="bg-[#131722] border border-[#1e2130] rounded-full px-3 py-1.5 active:opacity-70">
                <Text className="text-gray-300 text-xs">{p}</Text>
              </Pressable>
            ))}
          </View>
        )}
        renderItem={({ item: m }) => (
          <View className={`mb-3 flex-row ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <View className="w-8 h-8 bg-[#f0b90b] rounded-full items-center justify-center mr-2 flex-shrink-0 mt-1">
                <Bot size={14} color="black" />
              </View>
            )}
            <View
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${m.role === 'user' ? 'bg-[#f0b90b] rounded-tr-sm' : 'bg-[#131722] border border-[#1e2130] rounded-tl-sm'}`}
            >
              <Text className={`text-sm leading-relaxed ${m.role === 'user' ? 'text-black font-medium' : 'text-white'}`}>{m.content}</Text>
            </View>
            {m.role === 'user' && (
              <View className="w-8 h-8 bg-[#1e2130] rounded-full items-center justify-center ml-2 flex-shrink-0 mt-1">
                <User size={14} color="#9ca3af" />
              </View>
            )}
          </View>
        )}
        ListFooterComponent={() => loading ? (
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-8 h-8 bg-[#f0b90b] rounded-full items-center justify-center">
              <Bot size={14} color="black" />
            </View>
            <View className="bg-[#131722] border border-[#1e2130] px-4 py-3 rounded-2xl rounded-tl-sm">
              <ActivityIndicator size="small" color="#f0b90b" />
            </View>
          </View>
        ) : null}
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-4 py-3 border-t border-[#1e2130] gap-3">
          <TextInput
            className="flex-1 bg-[#131722] border border-[#1e2130] rounded-2xl px-4 py-3 text-white text-sm"
            placeholder="Hỏi về crypto, sản phẩm..."
            placeholderTextColor="#6b7280"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
          />
          <Pressable
            onPress={() => sendMessage()}
            disabled={loading || !input.trim()}
            className={`w-11 h-11 rounded-full items-center justify-center ${input.trim() && !loading ? 'bg-[#f0b90b]' : 'bg-[#1e2130]'}`}
          >
            <Send size={18} color={input.trim() && !loading ? 'black' : '#6b7280'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

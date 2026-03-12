import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../lib/store/auth-store';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react-native';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true); setError('');
    try {
      await login(email, password);
      router.back();
    } catch (e: any) {
      setError(e.response?.data?.message || t('auth.loginFailed'));
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0c0e14]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 px-6 justify-center">
          <Pressable onPress={() => router.back()} className="absolute top-4 left-4 p-2">
            <ArrowLeft size={22} color="#9ca3af" />
          </Pressable>

          {/* Logo / Title */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 bg-[#f0b90b] rounded-2xl items-center justify-center mb-4 shadow-lg">
              <Text className="text-black text-2xl font-black">₿</Text>
            </View>
            <Text className="text-white text-2xl font-bold">{t('auth.welcomeBack')}</Text>
            <Text className="text-gray-400 text-sm mt-1">{t('auth.loginToContinue')}</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {error ? (
              <View className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <Text className="text-red-400 text-sm">{error}</Text>
              </View>
            ) : null}

            <View>
              <Text className="text-gray-400 text-sm mb-1.5">{t('auth.emailOrUsername')}</Text>
              <TextInput
                className="bg-[#131722] border border-[#1e2130] rounded-xl px-4 py-3.5 text-white text-sm"
                placeholder="email@example.com"
                placeholderTextColor="#6b7280"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View className="mt-4">
              <Text className="text-gray-400 text-sm mb-1.5">{t('auth.password')}</Text>
              <View className="flex-row items-center bg-[#131722] border border-[#1e2130] rounded-xl px-4">
                <TextInput
                  className="flex-1 py-3.5 text-white text-sm"
                  placeholder="••••••••"
                  placeholderTextColor="#6b7280"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <Pressable onPress={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="mt-6 bg-[#f0b90b] rounded-xl py-4 items-center shadow-lg active:opacity-90"
            >
              {loading ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold text-base">{t('auth.login')}</Text>}
            </Pressable>

            <View className="flex-row justify-center mt-4 gap-1">
              <Text className="text-gray-400 text-sm">{t('auth.dontHaveAccount')}</Text>
              <Link href="/auth/register">
                <Text className="text-[#f0b90b] text-sm font-semibold">{t('auth.register')}</Text>
              </Link>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

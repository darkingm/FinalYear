import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import i18n, { LANGUAGES } from '../../lib/i18n';
import { useAuthStore } from '../../lib/store/auth-store';
import { LogIn, LogOut, Globe, Moon, ChevronRight, ShoppingBag, User, Package, Settings } from 'lucide-react-native';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);

  const handleLanguage = () => {
    const next = i18n.language === 'vi' ? 'en' : 'vi';
    i18n.changeLanguage(next);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0c0e14]">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-white text-2xl font-bold mb-6">{t('nav.profile')}</Text>

        {/* User Card */}
        {isAuthenticated ? (
          <View className="bg-[#131722] rounded-2xl p-5 border border-[#1e2130] mb-6">
            <View className="flex-row items-center gap-4">
              <View className="w-16 h-16 bg-[#f0b90b] rounded-full items-center justify-center">
                <Text className="text-black text-2xl font-black">{user?.username?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-lg">{user?.username}</Text>
                <Text className="text-gray-400 text-sm">{user?.email}</Text>
                <View className="mt-1 px-2.5 py-0.5 bg-[#f0b90b]/10 rounded-full self-start border border-[#f0b90b]/30">
                  <Text className="text-[#f0b90b] text-xs font-semibold">{user?.role?.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="bg-[#131722] rounded-2xl p-6 border border-[#1e2130] mb-6 items-center">
            <User size={40} color="#6b7280" />
            <Text className="text-white font-bold text-lg mt-3">{t('auth.loginToContinue')}</Text>
            <View className="flex-row gap-3 mt-4">
              <Link href="/auth/login" asChild>
                <Pressable className="flex-1 bg-[#f0b90b] rounded-xl py-3 items-center">
                  <Text className="text-black font-bold">{t('auth.login')}</Text>
                </Pressable>
              </Link>
              <Link href="/auth/register" asChild>
                <Pressable className="flex-1 bg-[#1e2130] border border-[#f0b90b]/30 rounded-xl py-3 items-center">
                  <Text className="text-[#f0b90b] font-bold">{t('auth.register')}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        )}

        {/* Settings Section */}
        <View className="bg-[#131722] rounded-2xl border border-[#1e2130] overflow-hidden mb-4">
          <Text className="text-gray-500 text-xs font-semibold uppercase px-5 pt-4 pb-2 tracking-wider">Tuỳ chỉnh</Text>

          {/* Language */}
          <Pressable onPress={handleLanguage} className="flex-row items-center px-5 py-4 border-t border-[#1e2130] active:bg-[#1e2130]">
            <Globe size={20} color="#9ca3af" />
            <Text className="text-white font-medium ml-3 flex-1">Ngôn ngữ</Text>
            <Text className="text-[#f0b90b] font-semibold mr-2">{i18n.language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}</Text>
            <ChevronRight size={16} color="#6b7280" />
          </Pressable>

          {/* Dark Mode */}
          <View className="flex-row items-center px-5 py-4 border-t border-[#1e2130]">
            <Moon size={20} color="#9ca3af" />
            <Text className="text-white font-medium ml-3 flex-1">Dark Mode</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: '#f0b90b', false: '#1e2130' }} thumbColor="white" />
          </View>
        </View>

        {/* Quick Links */}
        {isAuthenticated && (
          <View className="bg-[#131722] rounded-2xl border border-[#1e2130] overflow-hidden mb-4">
            <Text className="text-gray-500 text-xs font-semibold uppercase px-5 pt-4 pb-2 tracking-wider">Tài khoản</Text>
            {[
              { label: t('order.myOrders'), icon: Package, href: '/orders' as const },
            ].map(item => (
              <Link key={item.label} href={item.href} asChild>
                <Pressable className="flex-row items-center px-5 py-4 border-t border-[#1e2130] active:bg-[#1e2130]">
                  <item.icon size={20} color="#9ca3af" />
                  <Text className="text-white font-medium ml-3 flex-1">{item.label}</Text>
                  <ChevronRight size={16} color="#6b7280" />
                </Pressable>
              </Link>
            ))}
            <Pressable onPress={handleLogout} className="flex-row items-center px-5 py-4 border-t border-[#1e2130] active:bg-[#1e2130]">
              <LogOut size={20} color="#ef4444" />
              <Text className="text-red-400 font-medium ml-3">{t('nav.logout')}</Text>
            </Pressable>
          </View>
        )}

        <Text className="text-center text-gray-600 text-xs mt-4">CryptoMarket v1.0.0</Text>
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

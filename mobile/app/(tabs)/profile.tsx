import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import i18n from '../../lib/i18n';
import { useAuthStore } from '../../lib/store/auth-store';
import { LogOut, Globe, Moon, ChevronRight, User, Package, Award } from 'lucide-react-native';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 20 }}>{t('nav.profile')}</Text>

        {/* User Card */}
        {isAuthenticated ? (
          <View style={{ backgroundColor: '#131722', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e2130', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 60, height: 60, backgroundColor: '#f0b90b', borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'black', fontSize: 24, fontWeight: '900' }}>{user?.username?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>{user?.username}</Text>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>{user?.email}</Text>
                <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(240,185,11,0.1)', borderRadius: 20, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(240,185,11,0.3)' }}>
                  <Text style={{ color: '#f0b90b', fontSize: 10, fontWeight: '700' }}>{user?.role?.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: '#131722', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#1e2130', marginBottom: 20, alignItems: 'center' }}>
            <User size={40} color="#6b7280" />
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 17, marginTop: 12 }}>{t('auth.loginToContinue')}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' }}>
              <Link href="/auth/login" asChild style={{ flex: 1 }}>
                <Pressable style={{ backgroundColor: '#f0b90b', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: 'black', fontWeight: '800' }}>{t('auth.login')}</Text>
                </Pressable>
              </Link>
              <Link href="/auth/register" asChild style={{ flex: 1 }}>
                <Pressable style={{ backgroundColor: '#1e2130', borderWidth: 1, borderColor: 'rgba(240,185,11,0.3)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#f0b90b', fontWeight: '800' }}>{t('auth.register')}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={{ backgroundColor: '#131722', borderRadius: 18, borderWidth: 1, borderColor: '#1e2130', overflow: 'hidden', marginBottom: 14 }}>
          <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>TUỲ CHỈNH</Text>
          <Pressable onPress={handleLanguage} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1e2130' }}>
            <Globe size={20} color="#9ca3af" />
            <Text style={{ color: 'white', fontWeight: '500', marginLeft: 12, flex: 1 }}>Ngôn ngữ</Text>
            <Text style={{ color: '#f0b90b', fontWeight: '600', marginRight: 8 }}>{i18n.language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}</Text>
            <ChevronRight size={16} color="#6b7280" />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1e2130' }}>
            <Moon size={20} color="#9ca3af" />
            <Text style={{ color: 'white', fontWeight: '500', marginLeft: 12, flex: 1 }}>Dark Mode</Text>
            <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: '#f0b90b', false: '#1e2130' }} thumbColor="white" />
          </View>
        </View>

        {/* Account links */}
        {isAuthenticated && (
          <View style={{ backgroundColor: '#131722', borderRadius: 18, borderWidth: 1, borderColor: '#1e2130', overflow: 'hidden', marginBottom: 14 }}>
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>TÀI KHOẢN</Text>
            {[
              { label: t('order.myOrders'), icon: Package, href: '/orders' },
              { label: '🏆 Credit Score & SBT', icon: Award, href: '/profile/credit-score' },
            ].map((item: any) => (
              <Link key={item.label} href={item.href} asChild>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1e2130' }}>
                  <item.icon size={20} color="#9ca3af" />
                  <Text style={{ color: 'white', fontWeight: '500', marginLeft: 12, flex: 1 }}>{item.label}</Text>
                  <ChevronRight size={16} color="#6b7280" />
                </Pressable>
              </Link>
            ))}
            <Pressable onPress={handleLogout} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1e2130' }}>
              <LogOut size={20} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontWeight: '500', marginLeft: 12 }}>{t('nav.logout')}</Text>
            </Pressable>
          </View>
        )}

        <Text style={{ textAlign: 'center', color: '#4b5563', fontSize: 11, marginTop: 8 }}>CryptoMarket v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

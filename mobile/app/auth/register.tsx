import { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../lib/store/auth-store';
import { apiClient } from '../../lib/api/client';
import { Eye, EyeOff, ArrowLeft, Check, User, Mail, Lock } from 'lucide-react-native';

function PasswordStrength({ password }: { password: string }) {
  const strength = !password ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4
    : 3;
  const colors = ['#ef4444', '#f97316', '#eab308', '#10b981'];
  const labels = ['', 'Yếu', 'Trung bình', 'Tốt', 'Mạnh'];
  if (!password) return null;
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1,2,3,4].map(i => (
          <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= strength ? colors[strength-1] : '#1e2130' }} />
        ))}
      </View>
      <Text style={{ color: colors[strength-1], fontSize: 11, marginTop: 3 }}>{labels[strength]}</Text>
    </View>
  );
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore(s => s.login);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const checkScale = useRef(new Animated.Value(1)).current;

  const handleCheck = () => {
    setAgreed(a => !a);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1.3, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    if (!username || !email || !password) { setError('Vui lòng điền đầy đủ thông tin'); return; }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return; }
    if (password.length < 8) { setError(t('auth.passwordMinLength')); return; }
    if (!agreed) { setError('Vui lòng đồng ý với điều khoản'); return; }

    setLoading(true); setError('');
    try {
      await apiClient.post('/api/auth/register', { username, email, password, captcha: 'mobile-bypass' });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(email, password);
      router.replace('/');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, justifyContent: 'center' }}>

            {/* Back button */}
            <Pressable onPress={() => router.back()} style={{ alignSelf: 'flex-start', marginBottom: 24, width: 40, height: 40, borderRadius: 20, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e2130' }}>
              <ArrowLeft size={20} color="#9ca3af" />
            </Pressable>

            {/* Header */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ color: 'white', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>{t('auth.register')} 🚀</Text>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>{t('auth.noCreditCard')}</Text>
            </View>

            {/* Error */}
            {error ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 }}>
                <Text style={{ color: '#ef4444', fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            {/* Form fields */}
            {[
              { label: t('auth.username'), value: username, set: setUsername, icon: User, placeholder: 'your_username', type: 'default', secure: false },
              { label: t('auth.email'), value: email, set: setEmail, icon: Mail, placeholder: 'email@example.com', type: 'email-address', secure: false },
            ].map(field => (
              <View key={field.label} style={{ marginBottom: 16 }}>
                <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 6, fontWeight: '500' }}>{field.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#131722', borderWidth: 1, borderColor: '#1e2130', borderRadius: 14, paddingHorizontal: 14 }}>
                  <field.icon size={16} color="#6b7280" style={{ marginRight: 10 }} />
                  <TextInput
                    style={{ flex: 1, paddingVertical: 14, color: 'white', fontSize: 14 }}
                    placeholder={field.placeholder}
                    placeholderTextColor="#4b5563"
                    value={field.value}
                    onChangeText={field.set}
                    autoCapitalize="none"
                    keyboardType={field.type as any}
                  />
                </View>
              </View>
            ))}

            {/* Password */}
            <View style={{ marginBottom: 6 }}>
              <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 6, fontWeight: '500' }}>{t('auth.password')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#131722', borderWidth: 1, borderColor: '#1e2130', borderRadius: 14, paddingHorizontal: 14 }}>
                <Lock size={16} color="#6b7280" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 14, color: 'white', fontSize: 14, marginLeft: 10 }}
                  placeholder="min. 8 ký tự"
                  placeholderTextColor="#4b5563"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <Pressable onPress={() => setShowPass(s => !s)}>
                  {showPass ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
                </Pressable>
              </View>
              <PasswordStrength password={password} />
            </View>

            {/* Confirm Password */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 6, fontWeight: '500', marginTop: 12 }}>{t('auth.confirmPassword')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#131722', borderWidth: 1, borderColor: confirm && confirm !== password ? 'rgba(239,68,68,0.5)' : '#1e2130', borderRadius: 14, paddingHorizontal: 14 }}>
                <Lock size={16} color="#6b7280" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 14, color: 'white', fontSize: 14, marginLeft: 10 }}
                  placeholder="Nhập lại mật khẩu"
                  placeholderTextColor="#4b5563"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                />
                <Pressable onPress={() => setShowConfirm(s => !s)}>
                  {showConfirm ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
                </Pressable>
              </View>
            </View>

            {/* Terms checkbox */}
            <Pressable onPress={handleCheck} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: agreed ? '#f0b90b' : '#374151', backgroundColor: agreed ? '#f0b90b' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {agreed && <Check size={13} color="black" strokeWidth={3} />}
                </View>
              </Animated.View>
              <Text style={{ color: '#9ca3af', fontSize: 13, flex: 1 }}>
                {t('auth.termsText')} <Text style={{ color: '#f0b90b' }}>{t('auth.termsLink')}</Text> {t('auth.and')} <Text style={{ color: '#f0b90b' }}>{t('auth.privacyPolicy')}</Text>
              </Text>
            </Pressable>

            {/* Register Button */}
            <Pressable onPress={handleRegister} disabled={loading} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
              <LinearGradient
                colors={loading ? ['#374151', '#374151'] : ['#f0b90b', '#e6a800']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}
              >
                {loading
                  ? <ActivityIndicator color="black" />
                  : <Text style={{ color: 'black', fontWeight: '800', fontSize: 15 }}>{t('auth.createAccount')}</Text>
                }
              </LinearGradient>
            </Pressable>

            {/* Login link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>{t('auth.alreadyHaveAccount')}</Text>
              <Link href="/auth/login">
                <Text style={{ color: '#f0b90b', fontSize: 13, fontWeight: '700' }}>{t('auth.login')}</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

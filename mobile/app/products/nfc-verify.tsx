import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, Animated, Alert, ActivityIndicator, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ethers } from 'ethers';
import { Shield, CheckCircle, XCircle, ScanLine, Info } from 'lucide-react-native';

// Note: expo-camera CameraView usage
let CameraView: any;
let useCameraPermissions: any;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {}

/**
 * NFC/QR Scanner Screen — Physical-Digital Link verification.
 * Buyer scans the QR/NFC code on the physical product.
 * App hashes the scanned payload and calls verifyAndClaim on ProductNFT.
 */
export default function NFCVerifyScreen() {
  const { productId, tokenId } = useLocalSearchParams<{ productId: string; tokenId: string }>();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, () => {}];
  const [scanning, setScanning] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'success' | 'fail' | null>(null);
  const [scannedData, setScannedData] = useState('');

  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (!scanning || verifying) return;
    setScanning(false);
    setVerifying(true);
    setScannedData(data);
    Vibration.vibrate(100);

    try {
      // Hash the scanned QR payload — must match what was stored at minting
      const hash = ethers.keccak256(ethers.toUtf8Bytes(data));

      // In a real implementation, this would call verifyAndClaim on-chain
      // via WalletConnect. For now we call the backend relayer:
      const { apiClient } = await import('../../lib/api/client');
      await apiClient.post(`/api/nft/verify/${productId}`, {
        physicalHashInput: hash,
        tokenId,
      });

      setResult('success');
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 80 }).start();
      Vibration.vibrate([0, 100, 50, 200]);
    } catch (e: any) {
      setResult('fail');
      Vibration.vibrate([0, 500]);
    } finally {
      setVerifying(false);
    }
  };

  // No camera available — show manual hash input
  if (!CameraView) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14', padding: 20 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Info size={48} color="#f0b90b" />
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
            expo-camera chưa được cài
          </Text>
          <Text style={{ color: '#9ca3af', textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            Chạy: npx expo install expo-camera{'\n'}rồi rebuild app để dùng QR scanner
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}>
        <Shield size={22} color="#f0b90b" />
        <View>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '800' }}>Xác thực Vật phẩm</Text>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Quét mã QR / NFC trên sản phẩm</Text>
        </View>
      </View>

      {/* Camera / Result Area */}
      <View style={{ flex: 1, margin: 16, borderRadius: 24, overflow: 'hidden' }}>
        {result === null ? (
          <>
            {!permission?.granted ? (
              <View style={{ flex: 1, backgroundColor: '#131722', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <ScanLine size={48} color="#f0b90b" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                  Cần quyền truy cập Camera
                </Text>
                <Pressable onPress={requestPermission} style={{ marginTop: 20, backgroundColor: '#f0b90b', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 }}>
                  <Text style={{ color: 'black', fontWeight: '800' }}>Cấp quyền Camera</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
                  barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128'] }}
                />
                {/* Scanner overlay */}
                <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <View style={{ width: 220, height: 220, borderRadius: 16 }}>
                      {/* Corner brackets */}
                      {[
                        { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
                        { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
                        { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
                        { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
                      ].map((style, i) => (
                        <View key={i} style={{ position: 'absolute', width: 32, height: 32, borderColor: '#f0b90b', borderRadius: 4, ...style }} />
                      ))}
                    </View>
                  </Animated.View>
                  {verifying && (
                    <View style={{ marginTop: 24, alignItems: 'center' }}>
                      <ActivityIndicator color="#f0b90b" />
                      <Text style={{ color: 'white', marginTop: 10, fontWeight: '600' }}>Đang xác thực on-chain...</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        ) : result === 'success' ? (
          <LinearGradient colors={['#052e16', '#14532d']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Animated.View style={{ transform: [{ scale: successAnim }], alignItems: 'center' }}>
              <CheckCircle size={72} color="#22c55e" />
              <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginTop: 20, textAlign: 'center' }}>
                Xác thực thành công!
              </Text>
              <Text style={{ color: '#86efac', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
                Sản phẩm xác thực. NFT đã được chuyển vào ví của bạn.
              </Text>
              <View style={{ marginTop: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, maxWidth: 280 }}>
                <Text style={{ color: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }} numberOfLines={2}>{scannedData}</Text>
              </View>
            </Animated.View>
            <Pressable
              onPress={() => router.back()}
              style={{ position: 'absolute', bottom: 32, left: 24, right: 24, backgroundColor: '#22c55e', borderRadius: 16, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: 'black', fontWeight: '800', fontSize: 16 }}>Hoàn tất</Text>
            </Pressable>
          </LinearGradient>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1c0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <XCircle size={72} color="#ef4444" />
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '900', marginTop: 20, textAlign: 'center' }}>
              Xác thực thất bại
            </Text>
            <Text style={{ color: '#fca5a5', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
              Mã QR không khớp với NFT sản phẩm. Có thể đây là hàng giả hoặc sai sản phẩm.
            </Text>
            <Pressable
              onPress={() => { setResult(null); setScanning(true); }}
              style={{ marginTop: 32, backgroundColor: '#ef4444', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14 }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>Quét lại</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: '#131722', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1e2130' }}>
        <Text style={{ color: '#9ca3af', fontSize: 11, lineHeight: 18, textAlign: 'center' }}>
          Hướng camera vào mã QR / tem NFC dán trên sản phẩm. App sẽ tự động xác thực và chuyển NFT vào ví bạn khi khớp.
        </Text>
      </View>
    </SafeAreaView>
  );
}

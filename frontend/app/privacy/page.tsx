import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Shield, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | Web3Market',
  description: 'Chính sách bảo mật của Web3Market — thông tin về cách chúng tôi thu thập, sử dụng, và bảo vệ dữ liệu cá nhân của bạn.',
};

export default function PrivacyPage() {
  const lastUpdated = '23/04/2026';

  const sections = [
    {
      title: '1. Thông tin chúng tôi thu thập',
      content: `Khi bạn sử dụng Web3Market, chúng tôi có thể thu thập các loại thông tin sau:

**Thông tin tài khoản:** Địa chỉ email, tên người dùng (username), ảnh đại diện (nếu đăng nhập qua Google).

**Thông tin ví blockchain:** Địa chỉ ví công khai (wallet address) khi bạn kết nối MetaMask hoặc ví tương thích. Chúng tôi **không bao giờ** thu thập hoặc lưu trữ khóa riêng tư (private key) hay seed phrase của bạn.

**Thông tin giao dịch:** Mã giao dịch (transaction hash), số tiền, token được sử dụng, trạng thái đơn hàng, và lịch sử thanh toán on-chain.

**Thông tin kỹ thuật:** Địa chỉ IP, loại trình duyệt, thiết bị, cookies phiên làm việc (session cookies), và dữ liệu analytics ẩn danh.`,
    },
    {
      title: '2. Cách chúng tôi sử dụng thông tin',
      content: `Thông tin thu thập được sử dụng cho các mục đích:

- **Cung cấp dịch vụ:** Xử lý đơn hàng, thanh toán crypto, quản lý Escrow, và giải quyết tranh chấp.
- **Bảo mật tài khoản:** Xác thực đăng nhập, phát hiện hoạt động bất thường, bảo vệ chống gian lận.
- **Cải thiện trải nghiệm:** Phân tích hành vi sử dụng (ẩn danh) để tối ưu giao diện và tính năng.
- **Liên lạc:** Gửi email thông báo đơn hàng, cập nhật bảo mật, hoặc phản hồi yêu cầu hỗ trợ.

Chúng tôi **không** bán, cho thuê, hoặc chia sẻ thông tin cá nhân với bên thứ ba cho mục đích quảng cáo.`,
    },
    {
      title: '3. Blockchain & Tính công khai',
      content: `Web3Market hoạt động trên blockchain công khai. Điều này có nghĩa:

- Các giao dịch on-chain (transaction hash, địa chỉ ví, số tiền) là **công khai** và có thể được xem bởi bất kỳ ai thông qua block explorer.
- Smart contract Escrow lưu trữ thông tin thanh toán trên blockchain và không thể bị xóa hay chỉnh sửa.
- Chúng tôi khuyến khích bạn sử dụng ví riêng cho giao dịch trên Web3Market nếu cần bảo vệ danh tính.`,
    },
    {
      title: '4. Cookies & Phiên làm việc',
      content: `Chúng tôi sử dụng cookies cho:

- **Session cookies:** Duy trì phiên đăng nhập (NextAuth). Hết hạn khi đóng trình duyệt hoặc sau thời gian cấu hình.
- **Preference cookies:** Lưu cài đặt ngôn ngữ, theme (sáng/tối), và chain ID ưu tiên.
- **Analytics:** Dữ liệu ẩn danh để hiểu cách người dùng tương tác với nền tảng (không tracking cá nhân).

Bạn có thể tắt cookies trong cài đặt trình duyệt, nhưng một số tính năng có thể không hoạt động đúng.`,
    },
    {
      title: '5. Bên thứ ba',
      content: `Chúng tôi sử dụng các dịch vụ bên thứ ba:

- **Google OAuth:** Để đăng nhập bằng tài khoản Google (Google Privacy Policy áp dụng).
- **MetaMask / RainbowKit:** Kết nối ví (chạy hoàn toàn ở phía client, không qua server của chúng tôi).
- **Binance API:** Lấy giá crypto real-time (chỉ dữ liệu thị trường, không thông tin cá nhân).
- **hCaptcha:** Chống spam khi đăng ký (hCaptcha Privacy Policy áp dụng).`,
    },
    {
      title: '6. Lưu trữ & Bảo mật dữ liệu',
      content: `- Dữ liệu người dùng được lưu trữ trên hệ thống có mã hóa, kiểm soát truy cập nghiêm ngặt.
- Mật khẩu được hash bằng bcrypt với salt ngẫu nhiên — chúng tôi không lưu mật khẩu dạng plain text.
- Token xác thực (JWT) có thời hạn và được blacklist khi đăng xuất.
- Dữ liệu giao dịch trên blockchain là bất biến (immutable) và được bảo vệ bởi cơ chế đồng thuận.`,
    },
    {
      title: '7. Quyền của bạn',
      content: `Bạn có quyền:

- **Truy cập:** Xem toàn bộ thông tin cá nhân chúng tôi lưu trữ về bạn.
- **Chỉnh sửa:** Cập nhật email, username, ảnh đại diện, địa chỉ ví liên kết.
- **Xóa:** Yêu cầu xóa tài khoản và dữ liệu liên quan (ngoại trừ dữ liệu on-chain).
- **Xuất:** Tải về dữ liệu cá nhân ở định dạng có thể đọc được.

Để thực hiện các quyền trên, liên hệ support@web3market.com.`,
    },
    {
      title: '8. Thay đổi chính sách',
      content: `Chúng tôi có thể cập nhật chính sách bảo mật theo thời gian. Mọi thay đổi quan trọng sẽ được thông báo qua email hoặc banner trên website. Việc tiếp tục sử dụng dịch vụ sau khi cập nhật đồng nghĩa với việc bạn chấp nhận chính sách mới.`,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] right-[20%] w-[350px] h-[350px] bg-[#8247e5]/5 rounded-full blur-[120px]" />
          </div>
          <div className="container mx-auto px-4 py-16 max-w-3xl relative z-10">
            <div className="w-14 h-14 mb-6 rounded-2xl bg-[#8247e5]/10 border border-[#8247e5]/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-[#8247e5]" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-3">
              Chính sách bảo mật
            </h1>
            <p className="text-muted-foreground text-sm">
              Cập nhật lần cuối: {lastUpdated}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground leading-relaxed mb-10">
              Web3Market (&quot;chúng tôi&quot;) cam kết bảo vệ quyền riêng tư của bạn. Chính sách này mô tả cách chúng tôi thu thập, sử dụng, và bảo vệ thông tin cá nhân khi bạn sử dụng nền tảng thương mại điện tử Web3Market.
            </p>

            <div className="space-y-10">
              {sections.map((section) => (
                <div key={section.title}>
                  <h2 className="text-lg font-bold text-foreground mb-4">{section.title}</h2>
                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="mt-14 p-6 rounded-2xl bg-muted/50 border border-border">
              <h3 className="text-sm font-bold text-foreground mb-2">Liên hệ về bảo mật</h3>
              <p className="text-sm text-muted-foreground">
                Nếu bạn có câu hỏi về chính sách bảo mật hoặc cách chúng tôi xử lý dữ liệu, vui lòng liên hệ:
              </p>
              <p className="text-sm text-foreground font-medium mt-2">
                📧 support@web3market.com
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

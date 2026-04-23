import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  Wallet, ShieldCheck, ShoppingCart, Truck, AlertTriangle,
  CreditCard, Users, RefreshCw, HelpCircle, Lock, Globe, Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'FAQ — Câu hỏi thường gặp | Web3Market',
  description: 'Giải đáp các câu hỏi phổ biến về ví MetaMask, thanh toán crypto, Escrow, tranh chấp, và vận chuyển trên Web3Market.',
};

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  title: string;
  icon: React.ElementType;
  color: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQSection[] = [
  {
    title: 'Ví MetaMask & Kết nối',
    icon: Wallet,
    color: '#f6851b',
    items: [
      {
        q: 'Làm sao để tạo ví MetaMask?',
        a: 'Truy cập metamask.io, tải extension cho trình duyệt hoặc app mobile. Tạo ví mới và lưu cụm từ khôi phục (seed phrase) ở nơi an toàn. Không bao giờ chia sẻ seed phrase với bất kỳ ai.',
      },
      {
        q: 'Tại sao MetaMask báo "Wrong Network"?',
        a: 'Web3Market hiện hỗ trợ mạng Hardhat VPS (chain 31337), Base Sepolia, và Polygon Amoy cho testnet. Vào trang Ví → Network Diagnostics để thêm mạng đúng vào MetaMask tự động.',
      },
      {
        q: 'Tôi có thể dùng ví khác ngoài MetaMask không?',
        a: 'Có! Web3Market hỗ trợ hầu hết các ví EVM-compatible qua RainbowKit: MetaMask, Coinbase Wallet, WalletConnect, và nhiều ví khác.',
      },
      {
        q: 'Kết nối ví có an toàn không?',
        a: 'Kết nối ví chỉ cho phép dApp đọc địa chỉ công khai của bạn. Mỗi giao dịch đều yêu cầu bạn xác nhận (ký) trực tiếp trên ví. Web3Market không bao giờ có quyền truy cập khóa riêng tư của bạn.',
      },
    ],
  },
  {
    title: 'Thanh toán Crypto',
    icon: CreditCard,
    color: '#627eea',
    items: [
      {
        q: 'Web3Market hỗ trợ những token nào?',
        a: 'Hiện tại hỗ trợ ETH (native), USDT, và USDC. Danh sách token được mở rộng liên tục theo từng chain.',
      },
      {
        q: 'Phí giao dịch (gas fee) là bao nhiêu?',
        a: 'Phí gas phụ thuộc vào mạng blockchain bạn chọn. Trên Hardhat testnet, gas gần như miễn phí. Trên mainnet, phí dao động theo tình trạng mạng.',
      },
      {
        q: 'Thanh toán bị kẹt ở "Đang xác nhận" thì làm sao?',
        a: 'Kiểm tra trạng thái giao dịch trên block explorer. Nếu transaction đã được confirm trên chain nhưng UI chưa cập nhật, thử refresh trang. Nếu vẫn kẹt, liên hệ support kèm theo transaction hash.',
      },
    ],
  },
  {
    title: 'Escrow & Bảo vệ giao dịch',
    icon: ShieldCheck,
    color: '#10b981',
    items: [
      {
        q: 'Escrow hoạt động như thế nào?',
        a: 'Khi bạn thanh toán, tiền được giữ trong smart contract Escrow (không phải ở Web3Market). Tiền chỉ được chuyển cho người bán khi bạn xác nhận đã nhận hàng, hoặc tự động release sau thời hạn dispute.',
      },
      {
        q: 'Nếu tôi không nhận được hàng?',
        a: 'Mở tranh chấp (dispute) trong thời hạn quy định. Admin sẽ xem xét bằng chứng từ cả hai bên và quyết định refund hoặc release. Tiền vẫn an toàn trong Escrow suốt quá trình.',
      },
      {
        q: 'Người bán có thể lấy tiền trước khi giao hàng không?',
        a: 'Không. Smart contract Escrow chỉ cho phép release khi buyer xác nhận nhận hàng hoặc hết thời hạn dispute mà không có khiếu nại.',
      },
    ],
  },
  {
    title: 'Mua hàng & Vận chuyển',
    icon: Truck,
    color: '#f0b90b',
    items: [
      {
        q: 'Tôi có thể mua hàng mà không cần ví crypto?',
        a: 'Hiện tại Web3Market chỉ hỗ trợ thanh toán crypto. Bạn cần có ví (MetaMask hoặc tương thích) và token tương ứng để thanh toán.',
      },
      {
        q: 'Thời gian giao hàng bao lâu?',
        a: 'Thời gian giao hàng phụ thuộc vào người bán và phương thức vận chuyển. Xem chi tiết trong mô tả sản phẩm và chính sách của từng seller.',
      },
    ],
  },
  {
    title: 'Tranh chấp & Hoàn tiền',
    icon: AlertTriangle,
    color: '#ef4444',
    items: [
      {
        q: 'Làm sao để mở tranh chấp?',
        a: 'Vào Đơn hàng → chọn đơn cần khiếu nại → nhấn "Mở tranh chấp". Cung cấp lý do và bằng chứng (ảnh, chat, v.v.). Admin sẽ xem xét trong 24-48 giờ.',
      },
      {
        q: 'Hoàn tiền mất bao lâu?',
        a: 'Khi admin quyết định refund, tiền được chuyển lại ví bạn ngay lập tức qua smart contract. Không có delay từ ngân hàng hay bên trung gian.',
      },
    ],
  },
  {
    title: 'Tài khoản & Bảo mật',
    icon: Lock,
    color: '#8247e5',
    items: [
      {
        q: 'Tôi có thể đăng nhập bằng ví crypto không?',
        a: 'Có! Web3Market hỗ trợ "Login with Wallet" sử dụng SIWE (Sign-In with Ethereum). Bạn ký xác nhận trên MetaMask để đăng nhập, không cần email hay mật khẩu.',
      },
      {
        q: 'Làm sao để liên kết ví với tài khoản email?',
        a: 'Đăng nhập bằng email → vào trang Ví → nhấn "Liên kết ví". Xác nhận quyền sở hữu bằng chữ ký trên MetaMask.',
      },
      {
        q: 'Quên mật khẩu thì làm sao?',
        a: 'Nhấn "Quên mật khẩu" ở trang đăng nhập, nhập email và làm theo hướng dẫn trong email khôi phục. Link có hiệu lực 15 phút.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[10%] w-[400px] h-[400px] bg-[#f0b90b]/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[15%] w-[300px] h-[300px] bg-[#8247e5]/5 rounded-full blur-[100px]" />
          </div>
          <div className="container mx-auto px-4 py-16 max-w-4xl relative z-10 text-center">
            <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <HelpCircle className="w-7 h-7 text-black" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-3">
              Câu hỏi thường gặp
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
              Tìm câu trả lời nhanh cho các thắc mắc về ví crypto, thanh toán, Escrow, tranh chấp, và tài khoản trên Web3Market.
            </p>
          </div>
        </div>

        {/* FAQ Sections */}
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="space-y-10">
            {FAQ_DATA.map((section) => {
              const Icon = section.icon;
              return (
                <div key={section.title}>
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${section.color}15`, border: `1px solid ${section.color}30` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: section.color }} />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                  </div>

                  <div className="space-y-3">
                    {section.items.map((item, idx) => (
                      <details
                        key={idx}
                        className="group rounded-xl border border-border bg-card overflow-hidden"
                      >
                        <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-muted/50 transition-colors">
                          <span className="text-sm font-semibold text-foreground pr-4">{item.q}</span>
                          <span className="text-muted-foreground text-lg flex-shrink-0 transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <div className="px-5 pb-4 pt-0">
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact CTA */}
          <div className="mt-14 p-8 rounded-2xl bg-gradient-to-br from-[#f0b90b]/5 to-[#8247e5]/5 border border-[#f0b90b]/10 text-center">
            <Globe className="w-8 h-8 mx-auto mb-4 text-[#f0b90b]" />
            <h3 className="text-lg font-bold text-foreground mb-2">Không tìm thấy câu trả lời?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Liên hệ đội ngũ hỗ trợ của chúng tôi — phản hồi trong vòng 24 giờ.
            </p>
            <a
              href="mailto:support@web3market.com"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-black bg-gradient-to-r from-[#f0b90b] to-[#e6a800] rounded-xl hover:shadow-lg hover:shadow-yellow-500/20 transition-all"
            >
              <Zap className="w-4 h-4" />
              Gửi email hỗ trợ
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

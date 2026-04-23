import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FileText, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | Web3Market',
  description: 'Điều khoản sử dụng của Web3Market — quy định về trách nhiệm buyer/seller, thanh toán on-chain, Escrow, tranh chấp, và chính sách hoàn tiền.',
};

export default function TermsPage() {
  const lastUpdated = '23/04/2026';

  const sections = [
    {
      title: '1. Giới thiệu',
      content: `Bằng việc truy cập và sử dụng Web3Market ("Nền tảng"), bạn đồng ý tuân thủ và chịu ràng buộc bởi các điều khoản này. Nếu bạn không đồng ý, vui lòng không sử dụng nền tảng.

Web3Market là sàn thương mại điện tử phi tập trung, cho phép mua bán hàng hóa và dịch vụ bằng cryptocurrency, được bảo vệ bởi smart contract Escrow.`,
    },
    {
      title: '2. Tài khoản & Xác thực',
      content: `- Bạn phải từ 18 tuổi trở lên để tạo tài khoản.
- Mỗi người chỉ được sở hữu một tài khoản.
- Bạn chịu trách nhiệm bảo mật thông tin đăng nhập, seed phrase, và private key.
- Web3Market hỗ trợ đăng nhập bằng email/mật khẩu, Google OAuth, và Sign-In with Ethereum (SIWE).
- Chúng tôi có quyền tạm khóa hoặc xóa tài khoản vi phạm điều khoản mà không cần thông báo trước.`,
    },
    {
      title: '3. Trách nhiệm Người mua (Buyer)',
      content: `- Kiểm tra kỹ thông tin sản phẩm, giá, và chính sách giao hàng trước khi đặt hàng.
- Đảm bảo ví có đủ token và ETH (cho gas fee) trước khi thanh toán.
- Xác nhận nhận hàng đúng hạn hoặc mở tranh chấp nếu có vấn đề.
- Không lạm dụng hệ thống tranh chấp cho mục đích gian lận.
- Cung cấp bằng chứng trung thực khi tham gia tranh chấp.`,
    },
    {
      title: '4. Trách nhiệm Người bán (Seller)',
      content: `- Cung cấp thông tin sản phẩm chính xác, đầy đủ, không gây hiểu nhầm.
- Giao hàng đúng thời hạn và đúng mô tả.
- Phản hồi tranh chấp trong thời hạn quy định kèm bằng chứng.
- Không bán sản phẩm cấm (xem Mục 5).
- Duy trì ví payout hợp lệ để nhận thanh toán.
- Chịu trách nhiệm về chất lượng sản phẩm và dịch vụ hậu mãi.`,
    },
    {
      title: '5. Sản phẩm cấm',
      content: `Các sản phẩm/dịch vụ sau bị cấm trên Web3Market:

- Chất cấm, ma túy, và các chất kiểm soát.
- Vũ khí, đạn dược, và vật liệu nổ.
- Thông tin cá nhân, dữ liệu bị đánh cắp, và tài khoản gian lận.
- Phần mềm độc hại, malware, ransomware.
- Nội dung vi phạm bản quyền, hàng giả, hàng nhái.
- Dịch vụ rửa tiền hoặc tài trợ khủng bố.
- Nội dung bất hợp pháp theo pháp luật Việt Nam và quốc tế.

Vi phạm sẽ dẫn đến xóa sản phẩm, khóa tài khoản, và có thể bị báo cáo cho cơ quan chức năng.`,
    },
    {
      title: '6. Thanh toán On-chain',
      content: `- Mọi thanh toán được thực hiện trên blockchain thông qua smart contract.
- Giao dịch on-chain là **không thể đảo ngược** (irreversible) sau khi được xác nhận.
- Web3Market không giữ token của bạn — Escrow smart contract quản lý tiền trong quá trình giao dịch.
- Phí gas là trách nhiệm của người thực hiện giao dịch (buyer khi thanh toán, seller khi release).
- Giá hiển thị bằng token crypto; giá tham chiếu USD/VND chỉ mang tính tham khảo.`,
    },
    {
      title: '7. Smart Contract Escrow',
      content: `- Khi buyer thanh toán, token được giữ trong Escrow contract — không bên nào (kể cả Web3Market) có thể rút tiền tùy ý.
- Tiền được release cho seller khi: (a) Buyer xác nhận nhận hàng, hoặc (b) Hết thời hạn dispute mà không có khiếu nại.
- Refund được thực hiện khi: Admin phán quyết có lợi cho buyer sau quá trình tranh chấp.
- Web3Market thu phí giao dịch (fee) được deduct từ Escrow trước khi release cho seller.
- Smart contract được audit và công khai trên blockchain.`,
    },
    {
      title: '8. Tranh chấp (Dispute)',
      content: `- Buyer có thể mở tranh chấp trong thời hạn quy định sau khi nhận hàng.
- Cả hai bên cung cấp bằng chứng (ảnh, chat, tracking, v.v.).
- Admin Web3Market xem xét và đưa ra quyết định: Refund (hoàn tiền cho buyer) hoặc Release (chuyển tiền cho seller).
- Quyết định của Admin là cuối cùng cho phiên tranh chấp đó.
- Lạm dụng hệ thống tranh chấp sẽ dẫn đến hạn chế hoặc khóa tài khoản.`,
    },
    {
      title: '9. KYC & Xác minh',
      content: `- Hiện tại Web3Market không yêu cầu KYC bắt buộc cho buyer thông thường.
- Seller có thể được yêu cầu xác minh danh tính khi đạt ngưỡng giao dịch nhất định.
- Web3Market bảo lưu quyền yêu cầu KYC bất cứ lúc nào nếu phát hiện hoạt động đáng ngờ.
- Thông tin KYC được xử lý theo Chính sách bảo mật.`,
    },
    {
      title: '10. Hoàn tiền',
      content: `- Hoàn tiền chỉ được thực hiện thông qua quy trình tranh chấp và phán quyết của Admin.
- Khi được chấp thuận, refund được thực hiện tự động qua smart contract về ví gốc của buyer.
- Phí gas cho giao dịch refund do smart contract xử lý.
- Web3Market không hoàn tiền cho lỗi do người dùng (gửi sai địa chỉ, sai network, v.v.).`,
    },
    {
      title: '11. Giới hạn trách nhiệm',
      content: `- Web3Market là nền tảng trung gian — chúng tôi không sở hữu hay kiểm soát sản phẩm của seller.
- Chúng tôi không chịu trách nhiệm về: biến động giá crypto, mất mát do lỗi ví/network, hoặc tranh chấp ngoài phạm vi Escrow.
- Dịch vụ được cung cấp "nguyên trạng" (as-is). Chúng tôi không đảm bảo uptime 100% hoặc không có lỗi.
- Trách nhiệm tối đa của Web3Market trong mọi trường hợp không vượt quá phí dịch vụ đã thu.`,
    },
    {
      title: '12. Thay đổi điều khoản',
      content: `- Web3Market có quyền thay đổi điều khoản bất cứ lúc nào.
- Thay đổi quan trọng sẽ được thông báo trước ít nhất 7 ngày qua email hoặc banner trên website.
- Tiếp tục sử dụng nền tảng sau khi thay đổi có hiệu lực đồng nghĩa với việc bạn chấp nhận điều khoản mới.`,
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[15%] w-[350px] h-[350px] bg-[#f0b90b]/5 rounded-full blur-[120px]" />
          </div>
          <div className="container mx-auto px-4 py-16 max-w-3xl relative z-10">
            <div className="w-14 h-14 mb-6 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center">
              <FileText className="w-7 h-7 text-[#f0b90b]" />
            </div>
            <h1 className="text-4xl font-black text-foreground mb-3">
              Điều khoản sử dụng
            </h1>
            <p className="text-muted-foreground text-sm">
              Cập nhật lần cuối: {lastUpdated}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12 max-w-3xl">
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
            <h3 className="text-sm font-bold text-foreground mb-2">Liên hệ</h3>
            <p className="text-sm text-muted-foreground">
              Nếu bạn có câu hỏi về điều khoản sử dụng, vui lòng liên hệ:
            </p>
            <p className="text-sm text-foreground font-medium mt-2">
              📧 support@web3market.com
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

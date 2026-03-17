const axios = require('axios');

const API_URL = 'https://kienai.id.vn/api';

async function testPaymentFlow() {
    console.log('--- BẮT ĐẦU TEST E-COMMERCE PAYMENT FLOW ---');
    let token = '';

    try {
        // 1. Login To Get Token
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'buyer1@marketplace.com',
            password: 'Test@1234'
        });
        token = loginRes.data.data.access_token;
        console.log('✅ Bước 1: Login thành công (Buyer: buyer1@marketplace.com)');
        console.log(`   Token (rút gọn): ${token.substring(0, 30)}...`);

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Tạo đơn hàng (Checkout)
        console.log('\n📦 Bước 2: Tạo Đơn Hàng (Product ID: 45, Số lượng: 1)');
        const orderRes = await axios.post(`${API_URL}/orders`, {
            product_id: 45,
            quantity: 1,
            payment_method: 'crypto'
        }, { headers });
        const order = orderRes.data.order;
        console.log(`✅ Order đã tạo thành công!`);
        console.log(`   Internal Order ID: ${order.internal_order_id}`);
        console.log(`   Tổng tiền (USD): $${order.total_amount}`);
        console.log(`   Trạng thái hiện tại: ${order.status}`);

        // 3. Xin Báo Giá Escrow (Crypto Quote)
        console.log('\n💳 Bước 3: Lấy báo giá thanh toán bằng ETH trên Hardhat VPS (Chain 31337)');
        const quoteRes = await axios.post(`${API_URL}/payments/crypto/quote`, {
            order_id: order.order_id,
            token_symbol: 'ETH',
            preferred_chain_id: 31337
        }, { headers });
        const quote = quoteRes.data.quote;
        console.log(`✅ Báo giá thành công!`);
        console.log(`   Giá đổi (ETH/USD): $${quote.token_price}`);
        console.log(`   Số lượng Tokens cần gửi: ${quote.amount_token} ETH`);
        console.log(`   Contract Escrow: ${quote.escrow_contract}`);

        // 4. Giả lập ký Giao Dịch gửi lên mạng lưới (Mock)
        const mockTxHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        console.log(`\n🔗 Bước 4: Giả lập User đã ký qua MetaMask (TxHash: ${mockTxHash})`);

        // 5. Submit Transaction & Tự động Verify
        const submitRes = await axios.post(`${API_URL}/payments/crypto/submit`, {
            order_id: order.order_id,
            tx_hash: mockTxHash
        }, { headers });

        console.log(`✅ Đã submit TX cho Backend. Trạng thái Backend ban đầu: TX_SUBMITTED`);
        console.log(`⏳ Backend đang tự động kiểm chứng (Verify) mạng lưới...`);

        // Đợi 2 giây cho việc Backend tự động Verification (Auto-trigger cho chain 31337)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 6. Lấy trạng thái thanh toán cuối cùng
        const statusRes = await axios.get(`${API_URL}/orders/${order.order_id}`, { headers });
        console.log(`\n🎉 Bước 5: Trạng thái Order sau khi Backend đối chiếu Smart Contract:`);
        console.log(`   Tình trạng: ${statusRes.data.order.status} (Nếu Payment giả => TX_FAILED; Nếu thật => ONCHAIN_CONFIRMED)`);

    } catch (error) {
        console.error('\n❌ LỖI TRONG QUÁ TRÌNH TEST:');
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testPaymentFlow();

const axios = require('axios');

const MAIN_API_URL = 'http://localhost:5000/api';
const PAYMENT_API_URL = 'http://localhost:5001/api';

const BUYER_EMAIL = 'buyer@marketplace.com';
const BUYER_PASSWORD = 'Test@1234';

async function simulateFlow() {
    try {
        console.log('1. Logging in as Buyer...');
        const loginRes = await axios.post(`${MAIN_API_URL}/auth/login`, {
            email: BUYER_EMAIL,
            password: BUYER_PASSWORD
        });
        const buyerToken = loginRes.data.accessToken;
        console.log('✅ Buyer logged in successfully');

        console.log('\n2. Fetching products...');
        const productsRes = await axios.get(`${MAIN_API_URL}/products`);
        const products = productsRes.data.data;
        if (!products || products.length === 0) {
            console.log('❌ No products found to test with.');
            return;
        }
        const product = products[0];
        console.log(`✅ Selected product: ${product.name} (ID: ${product.product_id})`);

        console.log('\n3. Creating Order...');
        const createOrderRes = await axios.post(`${MAIN_API_URL}/orders`, {
            product_id: product.product_id,
            quantity: 1
        }, {
            headers: { Authorization: `Bearer ${buyerToken}` }
        });
        const order = createOrderRes.data.data;
        console.log(`✅ Order created successfully: ${order.order_id}`);

        console.log('\n4. Paying for Order...');
        // Note: In real app, buyer calls payment-service or we use wallet.
        // For testing, we might need a test API or wallet interaction.
        const payRes = await axios.post(`${PAYMENT_API_URL}/payments/pay/${order.order_id}`, {}, {
            headers: { Authorization: `Bearer ${buyerToken}` }
        });
        console.log(`✅ Payment initiated/completed: ${payRes.data.message || 'Success'}`);

        console.log('\n5. Simulating Logistics Webhook (SHIPPED)...');
        const webhookShipRes = await axios.post(`${MAIN_API_URL}/orders/webhook/logistics`, {
            order_id: order.order_id,
            status: 'SHIPPED',
            tracking_number: 'GHN-123456789'
        });
        console.log(`✅ Logistics updated to SHIPPED`);

        console.log('\n6. Simulating Logistics Webhook (DELIVERED)...');
        const webhookDeliverRes = await axios.post(`${MAIN_API_URL}/orders/webhook/logistics`, {
            order_id: order.order_id,
            status: 'DELIVERED'
        });
        console.log(`✅ Logistics updated to DELIVERED`);

        console.log('\n7. Buyer confirms receipt (COMPLETED)...');
        const confirmRes = await axios.put(`${MAIN_API_URL}/orders/${order.order_id}/status`, {
            status: 'COMPLETED'
        }, {
            headers: { Authorization: `Bearer ${buyerToken}` }
        });
        console.log(`✅ Order updated to COMPLETED. Escrow funds should be released!`);

        console.log('\n🎉 ALL STEPS COMPLETED SUCCESSFULLY');

    } catch (error) {
        console.error('❌ Error during simulation:', error.response?.data || error.message);
    }
}

simulateFlow();

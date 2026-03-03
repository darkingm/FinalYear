// Custom type declarations for @paypal/checkout-server-sdk
// The package uses CommonJS exports, so we declare it as a namespace + module

declare module '@paypal/checkout-server-sdk' {
    namespace paypal {
        namespace core {
            class SandboxEnvironment {
                constructor(clientId: string, clientSecret: string);
            }
            class LiveEnvironment {
                constructor(clientId: string, clientSecret: string);
            }
            class PayPalHttpClient {
                constructor(environment: SandboxEnvironment | LiveEnvironment);
                execute(request: any): Promise<{ result: any; statusCode: number }>;
            }
        }

        namespace orders {
            class OrdersCreateRequest {
                prefer(prefer: string): void;
                requestBody(body: any): void;
            }
            class OrdersCaptureRequest {
                constructor(orderId: string);
                requestBody(body: any): void;
            }
        }
    }

    // Allow both `import paypal from '...'` and `const paypal = require('...')`
    const paypal: typeof paypal;
    export = paypal;
}

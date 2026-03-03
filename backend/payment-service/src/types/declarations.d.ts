// Fallback module declarations for packages without official @types
// These are used as a safety net if @types/* packages are not installed

declare module 'pg' {
    export * from 'pg';
}

declare module '@paypal/checkout-server-sdk' {
    export * from '@paypal/checkout-server-sdk';
}

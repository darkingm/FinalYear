-- Set wallet_address for a seller so they can receive crypto payments.
-- Replace USER_ID and WALLET_ADDRESS with real values (e.g. user_id: 3, your MetaMask address).
-- Example: UPDATE users SET wallet_address = '0x1234...' WHERE user_id = 3;

UPDATE users
SET wallet_address = '0x476cEF89f9A4478B60102c092Dba389e839ABab4',  -- replace with real Ethereum address
    updated_at = NOW()
WHERE user_id = 3;

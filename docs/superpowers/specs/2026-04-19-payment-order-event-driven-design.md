# Payment + Order Event-Driven Upgrade Design

**Date:** 2026-04-19  
**Status:** Approved for implementation planning

## Goal

Nang cap subsystem `payment + order state sync` tu flow synchronous-first sang flow event-driven cuc bo, giai quyet cac diem yeu hien tai:

- stale state do polling + best-effort verify
- split-brain giua `payments` va `orders`
- publish event truoc commit
- route contract risk giua service-to-service
- request gia mao hoac replay o flow thanh toan

Pham vi chi gom:

- `payment-service`
- `main-service` lien quan den sync order state
- frontend checkout/order tracking lien quan den `payment session`

Khong gom:

- inventory event-driven day du
- notification/event bus cho toan bo he thong
- websocket realtime cho UI
- refactor toan bo auth stack

## Current Architecture Summary

Hien tai he thong hoat dong theo kieu:

1. `main-service` tao order va lock inventory
2. frontend goi `payment-service` de quote
3. frontend gui `tx_hash`
4. `payment-service` update order -> `TX_SUBMITTED`
5. `payment-service` fire-and-forget `verifyTransaction`
6. worker `tx-monitor` polling moi 10 giay de verify lai
7. `payment-service` update `payments`
8. `payment-service` update `orders`
9. frontend polling status de suy ra progression

Van de cot loi:

- `payments` va `orders` nam o 2 DB khac nhau
- state business tien len nho polling/verify retry, khong nho event chac chan
- request quote/submit hien phu thuoc chu yeu vao JWT, chua co session nonce de rang buoc business payload
- event co the duoc publish truoc khi transaction DB commit xong

## Target Architecture

Kien truc moi la `event-driven payment domain` voi 4 lop:

1. `payment session security layer`
2. `payment aggregate + outbox`
3. `payment event dispatcher / consumer`
4. `order projection sync`

### High-level Flow

1. `main-service` tao order nhu hien tai
2. frontend xin `payment session` tu `payment-service`
3. `payment-service` validate user + order + token + chain + amount, roi tao session co nonce + expiry
4. frontend dung session de lay quote
5. user ky va gui giao dich tren chain
6. frontend submit `tx_hash` kem `session_id + nonce`
7. `payment-service` ghi payment state + outbox event trong mot transaction logic an toan
8. dispatcher publish `payment.submitted`
9. worker/listener theo doi blockchain va phat sinh cac event:
   - `payment.confirming`
   - `payment.confirmed`
   - `payment.failed`
   - `payment.released`
   - `payment.refunded`
10. `main-service` consume cac event nay va sync `orders.status` idempotent
11. frontend doc order state + payment snapshot, khong con la thanh phan chinh day state tien len

## Component Design

### 1. Payment Session

Them bang `payment_sessions` trong `payment-service`.

Thuoc tinh chinh:

- `session_id`
- `nonce`
- `user_id`
- `order_id`
- `token_symbol`
- `chain_id`
- `amount_token`
- `quote_snapshot`
- `status`
- `expires_at`
- `used_at`
- `tx_hash`
- `created_at`
- `updated_at`

Muc dich:

- rang buoc request vao dung user/order/token/chain/amount
- chan replay request cu
- chan frontend tu sua payload thanh toan
- kiem soat TTL de quote het han ro rang

Quy tac:

- session chi duoc tao cho order hop le va user dung quyen
- session chi hop le trong mot khoang thoi gian ngan
- session da submit khong duoc dung lai cho tx khac
- session sai `nonce` hoac sai `amount/token/chain` bi reject ngay

### 2. Payment Aggregate

`payment-service` tro thanh noi so huu payment truth noi bo.

`payments` la aggregate chinh, co state machine:

- `session_created`
- `quoted`
- `submitted`
- `confirming`
- `confirmed`
- `failed`
- `released`
- `refunded`

State transition phai idempotent va chi duoc di xuoi, khong di lui tuy tien.

`blockchain` la truth cua giao dich on-chain.  
`payment-service` la truth cua payment processing state.  
`main-service` la business projection cua order state.

### 3. Outbox

Them bang `payment_outbox` trong `payment-service`.

Thuoc tinh:

- `event_id`
- `aggregate_type`
- `aggregate_id`
- `event_type`
- `payload`
- `published_at`
- `retry_count`
- `last_error`
- `created_at`

Muc dich:

- event khong duoc publish truoc khi DB state commit
- dispatcher doc outbox va publish sang RabbitMQ sau
- loi publish khong lam mat event

### 4. Inbox / Processed Events

`main-service` them bang `processed_events` hoac `payment_event_inbox`.

Muc dich:

- dam bao consume event idempotent
- event bi giao lap lai khong lam order state nhay trung
- de trace event nao da ap dung

## Order Projection Rules

Map payment event sang order status:

- `payment.submitted` -> `TX_SUBMITTED`
- `payment.confirming` -> `ONCHAIN_PENDING`
- `payment.confirmed` -> `PAID`
- `payment.failed` -> `TX_FAILED`
- `payment.released` -> `COMPLETED`
- `payment.refunded` -> `REFUNDED`

Projection rules:

- projection chi duoc ap dung neu event hop le trong state machine
- event cu khong duoc ghi de len state moi hon
- consume nhieu lan cung event phai an toan

## Security Design

### Request Integrity

Moi buoc `quote`, `submit`, `status`, `manual recheck` deu phai co:

- JWT hop le
- `session_id`
- `nonce`

Backend validate:

- user trong JWT phai khop `user_id` cua session
- order phai thuoc user hop le
- `token_symbol`, `chain_id`, `amount_token` phai khop session
- session chua het han
- session chua bi consume sai

### Replay Protection

Chan cac truong hop:

- gui lai quote cu sau khi session het han
- submit lai `nonce` cu voi tx khac
- dung session cua order A de submit cho order B
- sua payload client de doi token hoac chain

### Internal Service Trust

Internal call giua services khong duoc hardcode string route tuy y.

Can co:

- mot `contract module` cho internal route/path/event name
- internal auth thong qua `X-Internal-Service-Key` hoac co che service secret tuong duong
- integration test de dam bao `main-service` va `payment-service` cung hieu mot contract

## Event Contract

Tat ca payment events phai co contract thong nhat:

- `event_id`
- `event_type`
- `occurred_at`
- `payment_id`
- `order_id`
- `session_id`
- `tx_hash`
- `chain_id`
- `from_state`
- `to_state`
- `reason` neu fail
- `metadata`

Yeu cau:

- event phai versionable
- payload du thong tin de consumer khong can query mo ho qua nhieu
- event name phai on dinh, khong phu thuoc route string

## Worker / Verification Strategy

Worker khong con la co che chinh duy nhat de day state.

Worker/listener trong `payment-service` se:

- doc payment dang `submitted/confirming`
- verify blockchain
- ghi state moi + outbox event

`read-through verify` se duoc giu nhu safety net trong giai doan migration:

- neu frontend hoi status khi state dang pending
- service co the verify lai blockchain roi tra snapshot moi nhat

Muc tieu:

- event-driven la duong chinh
- read-through verify la duong cuu ho

## Error Handling

He thong phai handle ro rang cac ngoai le:

### Session errors

- session het han
- session sai nonce
- session da duoc su dung boi tx khac
- session mismatch user/order/token/chain/amount

Ket qua:

- reject request
- khong mutate state
- tra message ro rang cho UI

### Blockchain errors

- RPC timeout
- receipt chua co
- transaction reverted
- chain mismatch
- confirmation chua du

Ket qua:

- state sang `confirming` hoac `failed` theo quy tac
- co `reason`
- retry an toan

### Event transport errors

- publish MQ fail
- consumer crash giua chung
- event giao lap lai

Ket qua:

- outbox retry
- inbox idempotency
- event khong bi mat

### Data consistency errors

- payment DB update xong, event chua publish
- event published, consumer chua consume
- order projection lech voi payment truth

Ket qua:

- reconciliation job doi soat `payments` va `orders`
- co the repair projection tu payment truth

## Migration Strategy

Migration se theo huong backward-compatible.

### Phase 1

- them schema moi: `payment_sessions`, `payment_outbox`, `processed_events`
- them dispatcher/consumer/event contracts
- giu flow cu dang chay

### Phase 2

- frontend chuyen sang `payment session`
- submit flow moi
- order sync dua vao event
- worker cu giu lam fallback

### Phase 3

- sau khi verify on dinh, giam phu thuoc vao polling cu
- giu reconciliation + read-through verify

## Testing Strategy

Can test o 4 muc:

### Unit tests

- payment session validation
- nonce replay protection
- state transition rules
- event payload builders

### Integration tests

- submit -> outbox record
- dispatcher publish -> consumer sync order
- duplicate event khong gay double update
- order projection dung khi event den tre/lap

### Failure-path tests

- rollback DB khong duoc tao event “ao”
- MQ publish fail van con event trong outbox
- consumer crash xu ly lai khong hong state
- RPC timeout khong danh dau fail sai

### UI/API tests

- checkout chi submit duoc voi session hop le
- status endpoint tra snapshot dung
- order detail va checkout hien dung state machine moi

## Expected Outcome

Sau khi nang cap:

- frontend khong con la noi de business state tien len mot cach mong manh
- payment flow co anti-forgery va anti-replay manh hon
- event khong con bi publish truoc commit
- order state sync duoc day boi payment event, khong dua chu yeu vao polling
- split-brain van con o muc 2 DB, nhung duoc kiem soat bang event contract, idempotency, outbox/inbox va reconciliation

## Non-Goals

Ban nang cap nay khong nham muc tieu:

- event-driven toan bo he thong marketplace
- thay the toan bo auth bang zero-trust service mesh
- them realtime websocket cho moi surface
- refactor inventory thanh aggregate event-driven day du

Day la buoc nang cap dung tam vao `payment + order state sync`, du de loai bo cac diem yeu nghiem trong nhat cua kien truc hien tai.

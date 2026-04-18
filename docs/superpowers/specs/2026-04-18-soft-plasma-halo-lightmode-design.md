# Soft Plasma Halo Light Mode Design

## Goal

Thiết kế lại background hiệu ứng cho light mode để tạo cảm giác cao cấp, sống, và mềm quanh con trỏ chuột, đồng thời giữ nguyên globe hiện có và không làm UI bị rối.

Hiệu ứng mục tiêu là `Soft Plasma Halo`:

- nền trắng sạch
- một vùng lõm mềm bám chặt theo chuột
- một trường blob/hạt mềm nhiều màu hoạt động trong vùng halo quanh chuột
- blob tự đổi hình, đổi kích thước, xoay nhẹ và co giãn theo field
- không dùng grid, không dùng shell 3D lộ kỹ thuật, không dùng particle spawn/die kiểu pháo hoa

## Current Problems

Các hướng đã thử trước đó cho thấy ba vấn đề chính:

1. `Grid + sink` nhìn kỹ thuật, không đủ sang.
2. `3D shell particle` lộ cấu trúc mô phỏng, nhìn giống effect demo hơn là visual polish.
3. `Blob field` nếu motion không tốt sẽ thành “đống hạt màu”, không còn cảm giác là một khối plasma có tổ chức.

## Success Criteria

Hiệu ứng mới được xem là đạt khi:

- tâm hiệu ứng theo chuột gần như ngay lập tức
- khi chuột đứng yên, field vẫn tiếp tục “sống” nhẹ
- các blob không đứng im, không bay loạn, mà luôn morph mềm trong vùng hoạt động
- globe không bị bóp méo hoặc kéo lệch
- text và card UI vẫn dễ đọc
- tổng thể nhìn giống “khối plasma mềm” chứ không giống grid, confetti, hoặc game particle

## Visual Model

Light mode sẽ gồm ba lớp:

1. `Base layer`
   - nền trắng sạch
   - không có pattern toàn màn hình

2. `Sink layer`
   - một vùng lõm mềm ở ngay dưới chuột
   - biên bị méo theo chu kỳ chậm
   - highlight và shadow nhẹ để cho cảm giác lõm xuống mặt phẳng

3. `Plasma halo layer`
   - blob mềm nhiều màu nằm trong vùng hoạt động quanh chuột
   - blob gần tâm dày hơn, blob ngoài rìa mảnh hơn
   - màu là rainbow pha trộn, nhưng không chia dải cứng
   - từng blob là ellipse/capsule ngắn, có thể đổi hình liên tục

Dark mode không đổi.

## Motion Model

Motion được tách thành ba hệ:

### 1. Cursor Anchor

- tâm effect đi theo chuột gần như ngay lập tức
- chỉ giữ một lượng smoothing rất nhỏ để tránh giật
- không được có cảm giác kéo đuôi

### 2. Field Breathing

- biên vùng lõm và halo co giãn rất nhẹ theo chu kỳ dài
- không scale cả khối rõ ràng
- chủ yếu là biến dạng biên, thay đổi mật độ và hướng blob

### 3. Internal Blob Motion

Mỗi blob có:

- vị trí gốc trong field
- phase riêng
- tốc độ orbit/wobble riêng
- màu cơ sở riêng
- hình dạng cơ sở riêng

Tại mỗi frame, blob sẽ:

- đổi `width`
- đổi `height`
- đổi `rotation`
- dao động cục bộ quanh vị trí gốc
- đổi alpha nhẹ theo độ sâu và phase

Blob không spawn rồi chết. Tập blob là cố định để motion mượt và có tổ chức.

## Rendering Architecture

Tiếp tục dùng một canvas riêng trong:

- [LightWarpBackground.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/components/ui/LightWarpBackground.tsx)

Component này sẽ chỉ tồn tại trong light mode desktop.

### Internal Structure

`LightWarpBackground` sẽ được chia logic thành các khối sau:

1. `Cursor state`
   - vị trí chuột hiện tại
   - vị trí mục tiêu
   - alpha hiện/ẩn

2. `Field shape`
   - bán kính sink
   - bán kính halo
   - warp của biên ngoài

3. `Blob seed set`
   - một mảng blob cố định
   - không spawn/destroy theo mousemove

4. `Frame projection`
   - tính trạng thái blob theo thời gian hiện tại
   - chuyển blob seed thành blob frame để render

5. `Canvas renderer`
   - vẽ sink trước
   - vẽ blob phía sau/trước theo depth ordering

## Data Structures

### BlobSeed

Blob cố định cần tối thiểu:

- `angle`
- `radialBias`
- `orbitSpeed`
- `wobbleSpeed`
- `phase`
- `hue`
- `baseSize`
- `depthBias`
- `tilt`

### BlobFrame

Tại mỗi frame:

- `x`
- `y`
- `width`
- `height`
- `rotation`
- `alpha`
- `hue`
- `depth`

### FieldFrame

- `sinkRadius`
- `haloRadius`
- `xBend`
- `yBend`
- `edgeRipple`
- `coreGlow`

## Color Direction

Color phải đi theo hướng:

- trắng làm nền
- blob có màu cầu vồng pha trộn
- ưu tiên các tông cyan, violet, magenta, amber, coral, blue
- không dùng saturation cực đại ở tất cả blob cùng lúc
- blob phía sau mờ và nhạt hơn
- blob phía trước sáng hơn và có soft glow

Mục tiêu là “plasma cao cấp”, không phải “kẹo nhiều màu”.

## Shape Direction

Blob không phải là chấm tròn cứng.

Blob nên là:

- ellipse mềm
- capsule ngắn
- giọt ngắn bị kéo

Theo thời gian, blob được phép đổi qua lại giữa các dạng đó bằng cách thay đổi:

- tỉ lệ `width/height`
- độ xoay
- độ mềm của halo quanh blob

## Interaction Boundaries

Để effect không làm UI rối:

- blob chỉ hoạt động trong halo quanh chuột
- không được phủ mạnh lên toàn trang
- không được làm chữ khó đọc
- khi chuột rời viewport, effect fade dần về trắng sạch

## Performance Constraints

Để canvas đủ mượt:

- dùng blob cố định thay vì spawn/destroy
- blob count vừa phải, mục tiêu khoảng `96-140`
- không dùng physics simulation thật
- không dùng WebGL cho lớp plasma ở giai đoạn này
- ưu tiên canvas 2D và projection toán học đơn giản

## Testing Strategy

Thêm regression tests tại:

- [frontend/__tests__/light-warp-background.test.tsx](C:/Users/Asus/Documents/FYP/FYP/frontend/__tests__/light-warp-background.test.tsx)

Các test cần khóa:

- mode render đúng là `cursor-blob-field`
- bán kính sink nhỏ hơn bản cũ
- blob field đủ dày
- blob morph frame thực sự đổi `width/height/rotation` theo thời gian
- follow strength tăng mạnh khi cursor nhảy xa
- breathing warp làm méo biên mà không scale cả khối

## Non-Goals

Không làm trong batch này:

- bóp méo globe
- background dark mode mới
- mobile effect đầy đủ
- WebGL shader plasma
- particle system kiểu spawn/die truyền thống

## Recommended Implementation

Triển khai theo một batch duy nhất:

1. giữ nguyên globe layer
2. thay toàn bộ `LightWarpBackground` hiện tại bằng `Soft Plasma Halo`
3. cập nhật tests trước
4. verify bằng `jest`, `tsc`, `lint`, `build`

## Expected Outcome

Sau khi hoàn tất, light mode sẽ có:

- globe ổn định
- nền trắng sạch
- một vùng lõm mềm bám chuột
- một khối plasma blob sống, đổi hình liên tục, nhiều màu nhưng có tổ chức
- cảm giác gần với background đẹp của antigravity, nhưng sạch và đồng nhất hơn với website hiện tại

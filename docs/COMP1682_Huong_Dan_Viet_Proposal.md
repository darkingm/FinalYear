# COMP1682 — Hướng Dẫn Viết Project Proposal
> Tổng hợp đầy đủ từ: Proposal Template, Proposal Guideline, Moderator Feedback

---

## Tổng quan

Proposal là bài viết đầu tiên trong COMP1682. Bài này **chiếm điểm quan trọng** và được moderation kỹ — moderator năm 2025/2026 đã yêu cầu điều chỉnh **-10%** vì nhiều lỗi phổ biến (thiếu keywords, thiếu citations, thiếu SMART objectives, Gantt chart sai, LSEPI quá ngắn...). Hãy đọc kỹ hướng dẫn này trước khi viết.

---

## Cấu trúc Proposal (11 phần)

```
1. Introduction
2. Problem Statement
3. Project Aim and Objectives
4. Background and Literature Review
5. Proposed Project Development and Methodology
6. Project Scope and Feasibility
7. Project Evaluation and Success Criteria
8. Project Plan and Timeline
9. Expected Outcomes and Contributions
10. LSEPI Considerations and Risks
11. References
```

---

## 1. Introduction

### Mục đích
Giới thiệu dự án một cách ngắn gọn, hấp dẫn, nêu rõ bạn làm gì và tại sao quan trọng.

### Cần có 4 thành phần:

| Thành phần | Mô tả |
|---|---|
| **Project Topic** | Giới thiệu chủ đề và sự liên quan trong bối cảnh computing hiện tại |
| **Motivation** | Lý do cá nhân/học thuật khiến bạn chọn đề tài này |
| **Problem Summary** | Tóm tắt ngắn vấn đề cốt lõi mà dự án giải quyết |
| **Originality & Significance** | Điểm mới/độc đáo của hướng tiếp cận của bạn so với những gì đã có |

### Lưu ý quan trọng:
- ✅ Giữ mỗi thành phần 1–2 đoạn văn
- ✅ Mở đầu bằng câu khai mạc mạnh, gắn với xu hướng thực tế
- ✅ Nêu rõ điểm khác biệt của dự án
- ❌ Không đi vào chi tiết kỹ thuật ở đây
- ❌ Không dùng câu mơ hồ như "This is important because..."
- ❌ Không copy-paste từ các phần khác

### Ví dụ tốt:
> *Topic:* "With the rise of e-commerce, customer churn has become a critical challenge for subscription-based businesses..."
>
> *Originality:* "Unlike existing solutions that focus solely on demographic data, this project will integrate behavioral patterns to produce more accurate predictions."

---

## 2. Problem Statement

### Mục đích
Làm rõ vấn đề cụ thể bạn giải quyết và lý do cần giải quyết nó.

### 3 yếu tố bắt buộc:

#### 2.1 Problem Definition
- Định nghĩa chính xác, cụ thể — tránh mơ hồ
- Dùng thuật ngữ có thể đo lường được
- Tập trung vào **MỘT** vấn đề chính

#### 2.2 Problem Significance
- Giải thích tác động đến đối tượng người dùng/domain
- **Dùng số liệu/thống kê có trích dẫn** để thể hiện tầm quan trọng
- Trả lời câu hỏi: "Điều gì xảy ra nếu vấn đề này không được giải quyết?"

#### 2.3 Context & Assumptions
- Nêu rõ bối cảnh và các ràng buộc thực tế
- Liệt kê các giả định về dữ liệu, môi trường, người dùng
- Thành thật về các giới hạn

### So sánh câu yếu vs. câu mạnh:

❌ **Yếu:** "Customer churn is a problem for businesses."

✅ **Mạnh:** "Subscription-based SaaS companies experience an average churn rate of 5–7% monthly, resulting in significant revenue loss (Smith, 2023). Current prediction methods rely on basic demographic analysis, failing to capture behavioral patterns that indicate customer dissatisfaction."

---

## 3. Project Aim and Objectives

### Sự khác biệt giữa Aim và Objectives:

| | Aim | Objectives |
|---|---|---|
| **Số lượng** | MỘT mục tiêu bao quát | 3–5 mục tiêu cụ thể |
| **Phạm vi** | Rộng, toàn diện | Chi tiết, có thể thực hiện |
| **Công nghệ** | KHÔNG đề cập tool cụ thể | KHÔNG đề cập tech stack cụ thể |
| **Format** | Một câu hoàn chỉnh | Mỗi mục bắt đầu bằng "To + verb" |

### Viết Aim tốt:
**Công thức:** "To [action verb] a [type of system] that [does what] for [target users] in order to [achieve benefit]."

❌ **Quá ngắn/mơ hồ:** "To build an eCommerce website."

❌ **Có tech cụ thể (sai):** "To develop a React-based eCommerce platform using Node.js and MongoDB."

✅ **Tốt:** "To design and develop a fully functional eCommerce web application that enables small local businesses to showcase and sell their products online, providing customers with a seamless shopping experience including product browsing, cart management, secure checkout, and order tracking, thereby helping local businesses expand their market reach and compete in the digital marketplace."

### SMART Objectives — Framework:

Mỗi objective PHẢI:
- **S**pecific — Rõ ràng, xác định được hành động
- **M**easurable — Có thể đo lường (số liệu, phần trăm)
- **A**chievable — Thực tế với kỹ năng và nguồn lực của bạn
- **R**elevant — Liên kết trực tiếp đến Aim
- **T**ime-bound — Có deadline rõ ràng

**Action verbs thường dùng:** To investigate, To design, To develop, To implement, To evaluate, To analyze, To create, To integrate, To test, To document

### Ví dụ Objectives (dự án eCommerce):

| # | Objective | Timeline |
|---|---|---|
| 1 | To investigate existing eCommerce solutions and identify essential features for small business needs | Week 1–3 |
| 2 | To gather and analyze requirements from potential users (min. 5 local business owners) | Week 3–4 |
| 3 | To design the system architecture, database schema, and user interface mockups | Week 5–6 |
| 4 | To implement core features: product catalog, shopping cart, and user authentication | Week 7–10 |
| 5 | To integrate a secure payment gateway and order management system | Week 11–12 |
| 6 | To evaluate the system through user testing with at least 10 participants | Week 13–14 |

> ⚠️ **Lưu ý từ Moderator:** Objectives phải phản ánh **toàn bộ phạm vi dự án**, không chỉ product build. SMART objectives bị thiếu ở nhiều bài và là lý do chính bị trừ điểm.

---

## 4. Background and Literature Review

### Mục đích
Phân tích phê bình các công trình hiện có, không phải chỉ tóm tắt — đây là nền tảng cho toàn bộ dự án.

### 4 thành phần chính:

#### 4.1 Theoretical Underpinnings
Xác định và thảo luận các khái niệm, framework, lý thuyết liên quan đến dự án.

#### 4.2 Review of Existing Solutions
Thảo luận về các sản phẩm, bài báo học thuật, và hướng tiếp cận liên quan.

#### 4.3 Critical Analysis (phần quan trọng nhất)
**KHÔNG** chỉ mô tả — hãy đánh giá phê phán:

| Aspect | Questions to Consider |
|---|---|
| Strengths | Họ làm tốt điều gì? Có điểm sáng tạo nào không? |
| Weaknesses | Có giới hạn nào? Còn thiếu gì? |
| Methodology | Có chặt chẽ không? Có thể tái lặp không? |
| Results | Kết quả có hợp lệ không? Cỡ mẫu đủ không? |
| Relevance | Liên quan đến dự án của bạn như thế nào? |
| Gap | Điểm này tạo ra cơ hội nào cho bạn? |

#### 4.4 Justification — Kết nối với dự án của bạn
Giải thích rõ ràng dự án của bạn lấp đầy gap như thế nào.

### Lưu ý quan trọng:
- ✅ Dùng nguồn uy tín: journals (ACM, IEEE), conferences, industry reports
- ✅ Tổ chức theo chủ đề, không chỉ theo thời gian
- ✅ So sánh và đối chiếu các hướng tiếp cận khác nhau
- ✅ Trích dẫn ít nhất **10–15 nguồn**
- ✅ Xác định rõ gap trong nghiên cứu hiện có
- ❌ Không chỉ tóm tắt — phải phân tích phê phán
- ❌ Không dựa chủ yếu vào Wikipedia hay blog
- ❌ Không thêm nguồn không liên quan để tăng số lượng
- ❌ Không đạo văn

> ⚠️ **Lưu ý từ Moderator:** Background/problem statement **phải có citations**. Thiếu citations là lỗi phổ biến và ảnh hưởng trực tiếp đến điểm số.

---

## 5. Proposed Project Development and Methodology

### Mục đích
Giải thích chi tiết "HOW" — bạn sẽ xây dựng và quản lý dự án như thế nào, với bằng chứng cho các lựa chọn kỹ thuật.

### 5 thành phần:

#### 5.1 Methodology Selection
Tham chiếu journals và nguồn uy tín, thảo luận các methodology phổ biến trong domain:
- **Agile/Scrum** — phù hợp với dự án có yêu cầu thay đổi, phát triển lặp
- **Waterfall** — phù hợp với dự án yêu cầu rõ ràng từ đầu
- **Spiral** — cân bằng giữa iterative và risk management
- **CRISP-DM** — dành cho dự án data science
- **Design Science Research** — dành cho dự án nghiên cứu
- **Prototyping methodology** — phù hợp khi cần phản hồi người dùng sớm

**Framework để justify lựa chọn:**
1. Identify Options: "Several methodologies exist: A, B, C..."
2. Compare with Evidence: "According to [Author, Year], methodology A..."
3. State Your Choice: "For this project, I will use methodology B..."
4. Justify with Reasons: "This is appropriate because..."

#### 5.2 Tools and Technologies
Liệt kê môi trường phát triển, ngôn ngữ, frameworks, libraries, tools. **Mỗi lựa chọn phải có lý do cụ thể.**

Ví dụ:

| Component | Choice | Justification |
|---|---|---|
| Language | Python 3.11 | Industry standard for ML; rich library ecosystem |
| ML Framework | Scikit-learn | Well-documented; suitable for classification tasks |
| Database | PostgreSQL | Robust; handles large datasets efficiently |
| IDE | VS Code | Free; excellent Python support |
| Version Control | Git/GitHub | Industry standard; collaboration support |

#### 5.3 Data Management (nếu có)
Giải thích cách thu thập, lưu trữ và phân tích dữ liệu.

#### 5.4 Development Plan
Mô tả các giai đoạn chính của quá trình phát triển (requirements, design, implementation, testing).

> ⚠️ **Lưu ý từ Moderator:** Phần methodology phải có **research citations** và thể hiện được sự so sánh, đối chiếu, đánh giá phê phán các methodological approach — không chỉ mô tả những gì bạn dự định làm.

---

## 6. Project Scope and Feasibility

### Scope — Ranh giới dự án:

| In-Scope (Sẽ thực hiện) | Out-of-Scope (Sẽ không thực hiện) |
|---|---|
| Tính năng cốt lõi thiết yếu | Tính năng "nice-to-have" |
| MVP functionality | Tối ưu hóa nâng cao |
| Testing trên dataset xác định | Production deployment |
| Desktop/web application | Mobile application |

> 💡 Rõ ràng về out-of-scope giúp tránh "scope creep" và đặt kỳ vọng thực tế.

### Feasibility Analysis — 3 chiều:

#### Time
- Timeline có thực tế không với thời gian đã cho?
- Có thêm buffer time cho các vấn đề bất ngờ không?

#### Technical
- Bạn có kỹ năng lập trình cần thiết không?
- Có thể học công nghệ mới trong timeline không?
- Độ phức tạp kỹ thuật có quản lý được không?

#### Resources
- Có thể truy cập dataset cần thiết không?
- Software/hardware có sẵn không?
- Chi phí (hosting, APIs) có trong tầm kiểm soát không?

---

## 7. Project Evaluation and Success Criteria

### Mục đích
Định nghĩa cách bạn đo lường sự thành công của dự án — **trước** khi bắt đầu build.

### Evaluation Methods theo Project Type:

| Project Type | Evaluation Methods |
|---|---|
| ML/AI | Accuracy, Precision, Recall, F1-Score, ROC-AUC |
| Web/Mobile App | User testing, Performance metrics, Usability |
| System/Software | Unit tests, Integration tests, Benchmarks |
| Research | Statistical analysis, Hypothesis testing |

### Ví dụ Success Criteria tốt:

| Criterion | Metric | Target |
|---|---|---|
| Model Accuracy | Classification accuracy | > 85% |
| Response Time | API latency | < 500ms |
| User Satisfaction | SUS Score | > 70 |
| Code Quality | Test coverage | > 80% |

### Ví dụ Success Criteria kém:
- ❌ "The system will work well"
- ❌ "Users will like the application"
- ❌ "The model will be accurate"

> 💡 **Nguyên tắc:** Nếu không đo được, bạn không thể chứng minh được!

---

## 8. Project Plan and Timeline

### Yêu cầu bắt buộc: **Gantt Chart**

Gantt chart là **bắt buộc** và phải thể hiện:
- Major milestones
- Tasks cụ thể
- Dependencies (task nào phải xong trước task nào)
- Buffer time (10–15% tổng thời gian)

### Mẫu Gantt Chart cơ bản:

```
TASK                    |W1|W2|W3|W4|W5|W6|W7|W8|W9|W10|W11|W12|
------------------------|--|--|--|--|--|--|--|--|--|---|---|---|
Literature Review       |██|██|██|  |  |  |  |  |  |   |   |   |
Requirements Gathering  |  |██|██|  |  |  |  |  |  |   |   |   |
System Design           |  |  |██|██|  |  |  |  |  |   |   |   |
Implementation Phase 1  |  |  |  |██|██|██|  |  |  |   |   |   |
Implementation Phase 2  |  |  |  |  |  |██|██|██|  |   |   |   |
Testing                 |  |  |  |  |  |  |██|██|██|   |   |   |
Evaluation              |  |  |  |  |  |  |  |  |██|██ |   |   |
Report Writing          |  |  |  |  |  |  |  |  |██|██ |██ |██ |
Buffer/Contingency      |  |  |  |  |  |  |  |  |  |   |██ |██ |
```

### Lưu ý quan trọng về Gantt Chart:

> ⚠️ **Lưu ý từ Moderator:** Gantt chart phải thể hiện **Agile approach** nếu bạn chọn Agile — nghĩa là phải có **parallel backend và frontend activities**, **iterative sprints**, và **overlapping tasks** thể hiện concurrent development. Gantt chart tuyến tính đơn thuần không phản ánh đúng Agile.

- ✅ Bắt đầu với milestones lớn, sau đó breakdown
- ✅ Thực tế — tính đến các cam kết khác
- ✅ Bao gồm thời gian viết report (thường bị underestimate)
- ✅ Lên kế hoạch cho các vòng lặp và revision
- ✅ Bao gồm thời gian họp với supervisor
- ❌ Không nhồi tất cả vào tuần cuối
- ❌ Không có các tasks liền kề nhau không có buffer
- ❌ Không quên testing và documentation

---

## 9. Expected Outcomes and Contributions

### Deliverables — Cần liệt kê cụ thể:

| Deliverable Type | Ví dụ |
|---|---|
| Software | Web app, Mobile app, Desktop application |
| Model/Algorithm | ML model, Prediction system |
| Documentation | Technical report, User manual |
| Research | Research paper, Dataset, Framework |
| Prototype | Proof of concept, MVP |

### Contribution — Kết nối với Literature Review:

```
Literature Review ──→ Gap Identified
        │
        ▼
  Your Project   ──→ Addresses Gap
        │
        ▼
  Contribution   ──→ Advances Knowledge/Practice
```

> 💡 Contribution của bạn phải **trực tiếp giải quyết** gap bạn xác định trong Literature Review.

---

## 10. LSEPI Considerations and Risks

### LSEPI — Legal, Social, Ethical, Professional Issues

> ⚠️ **Lưu ý từ Moderator:** LSEPI được nhiều bài xử lý "quá ngắn" và cần được **mở rộng với citations liên quan**. Đây là phần thể hiện độ trưởng thành và nhận thức chuyên nghiệp.

| Category | Key Considerations |
|---|---|
| **Legal** | Data protection (GDPR), Copyright, Licensing của third-party libraries |
| **Social** | Impact on users, Accessibility, Digital divide |
| **Ethical** | Privacy, Bias in AI, Informed consent, Data storage security |
| **Professional** | Code of conduct, Quality standards, Honesty, Version control |

### LSEPI theo loại dự án:

| Project Type | LSEPI Considerations |
|---|---|
| ML/AI | Bias in training data, Algorithmic fairness |
| Web App | User privacy, Data security, Accessibility |
| Healthcare | Patient confidentiality, Medical ethics |
| E-commerce | Consumer protection, Payment security |
| Social Media | Content moderation, Mental health impact |

### Risk Management

#### Các rủi ro thường gặp:

| Risk Category | Example | Mitigation Strategy |
|---|---|---|
| Technical | Cannot achieve target accuracy | Start with simpler model; iterative improvement |
| Data | Insufficient data available | Identify alternative datasets early |
| Time | Implementation takes longer | Build buffer time; prioritize core features |
| Resource | Software license unavailable | Use open-source alternatives |
| External | Supervisor unavailable | Schedule regular meetings; document decisions |

#### Risk Assessment Matrix:

```
             │ Low Impact │ Medium Impact │ High Impact │
─────────────┼────────────┼───────────────┼─────────────┤
High Likeli- │  MEDIUM    │     HIGH      │  CRITICAL   │
hood         │            │               │             │
─────────────┼────────────┼───────────────┼─────────────┤
Medium Like- │   LOW      │    MEDIUM     │    HIGH     │
lihood       │            │               │             │
─────────────┼────────────┼───────────────┼─────────────┤
Low Likeli-  │   LOW      │     LOW       │   MEDIUM    │
hood         │            │               │             │
```
*Tập trung vào HIGH và CRITICAL risks trước!*

---

## 11. References

- Dùng **Harvard referencing style** nhất quán cho cả in-text citations và reference list
- Trích dẫn ít nhất **10–15 nguồn** uy tín
- Tất cả claims quan trọng trong Problem Statement, Literature Review và Methodology **phải có citations**

---

## Checklist trước khi nộp Proposal

```
[ ] Introduction — Rõ ràng, hấp dẫn, nêu được tính độc đáo
[ ] Problem Statement — Cụ thể, có ý nghĩa, có citations, có assumptions
[ ] Aim & Objectives — Một aim, objectives SMART, bắt đầu bằng "To + verb"
[ ] Literature Review — Phân tích phê phán, xác định gaps, ≥10-15 nguồn
[ ] Methodology — Có citations, có so sánh các approach, justify lựa chọn
[ ] Scope & Feasibility — Ranh giới rõ ràng, đánh giá thực tế
[ ] Evaluation — Success criteria đo lường được
[ ] Timeline — Gantt chart chi tiết có buffer, thể hiện Agile nếu dùng Agile
[ ] Outcomes — Liệt kê deliverables cụ thể
[ ] LSEPI & Risks — Đầy đủ, có citations, có mitigation strategies
[ ] References — Harvard style, đầy đủ
[ ] Grammar & Formatting — Đã proof-read, format đúng
```

---

## 10 Lỗi phổ biến nhất cần tránh

1. **Problem statement mơ hồ** — không đủ cụ thể và không có số liệu
2. **Objectives không SMART** — thiếu thời hạn, không đo được
3. **Literature review chỉ tóm tắt** — không phân tích, không so sánh
4. **Methodology không có justification** — không có references
5. **Scope quá tham vọng hoặc không rõ** — không có out-of-scope
6. **Timeline không thực tế** — không có buffer, không phản ánh Agile
7. **Success criteria không đo được** — "system will work well"
8. **LSEPI quá ngắn** — thiếu expansion và citations
9. **Không có risk mitigation** — chỉ liệt kê rủi ro mà không có giải pháp
10. **Thiếu citations** — đặc biệt trong problem statement và methodology

---

## Ghi chú từ Moderator (2025/2026)

Dựa trên feedback của Moderator Aditi Rawal (21 Jan 2026), các vấn đề chính của cohort năm nay:

- **Keywords bị thiếu** trong introduction/topic area
- **Background/problem statement thiếu citations** — phải có references cho mọi claim quan trọng
- **SMART objectives vắng mặt** — không có trong các bài được lấy mẫu
- **Product review section bị thiếu** — cần so sánh 2 sản phẩm tương tự dùng Nielsen's heuristics
- **Methodology section yếu** — cần so sánh, đối chiếu, đánh giá phê phán các phương pháp với citations
- **LSEPI quá ngắn** — cần mở rộng với relevant citations
- **Gantt chart thiếu hoặc không đủ** — phải có, và phải thể hiện logical dependencies + Agile concurrent tasks
- **Bài đạt 80% phải viết ở third person** (học thuật)

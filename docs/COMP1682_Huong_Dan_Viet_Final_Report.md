# COMP1682 — Hướng Dẫn Viết Final Year Report
> Tổng hợp đầy đủ từ: Final Year Report Template, Final Year Report Guide, Moderator Feedback

---

## Tổng quan

Final Year Report là bài nộp cuối cùng của COMP1682 và là bằng chứng toàn diện về toàn bộ quá trình phát triển dự án. Moderator năm 2025/2026 đề nghị điều chỉnh **-5%** và yêu cầu cải thiện nhiều mặt — đặc biệt về product review, Gantt chart Agile, và tránh screen dumps không có critical evaluation. Đọc kỹ trước khi viết.

---

## Cấu trúc Report (12 phần)

```
1.  Introduction
2.  Background and Literature Review
3.  Requirements Analysis
4.  Methodology and Project Planning
5.  System Design and Architecture
6.  Implementation
7.  Testing
8.  Legal, Social, Ethical, and Professional Issues (LSEPI)
9.  Conclusion and Critical Reflection
10. References
11. Appendix A — Project Proposal
12. Appendix B — Images of Final Product
```

---

## Trang bìa

```
[Project Name]
[Student Name]
[Student ID]
Supervisor: [Name]

Final Year Report
COMP1682 Final Year Project
Program Title: BSc Hons Computing
Submission date: dd-mm-yyyy
Word count: xxx
```

---

## Abstract (200–350 từ)

Abstract là tóm tắt toàn bộ dự án, thường dùng cho academic presentations. Phải bao gồm:
- Vấn đề đã giải quyết
- Phương pháp tiếp cận
- Kết quả đạt được
- Đóng góp/ý nghĩa

> ⚠️ **Quan trọng:** Phải tự viết abstract — không được copy từ template hay nguồn khác (đạo văn).

---

## Acknowledgements

Cảm ơn supervisor, những người hỗ trợ, và bất kỳ ai đóng góp cho dự án. Phải tự viết bằng lời của mình.

---

## 1. Introduction

### Mục đích
Đặt nền tảng cho toàn bộ dự án — ngắn gọn, hấp dẫn, nêu rõ mục đích.

### 1.1 General Overview
Giới thiệu ngắn gọn về domain của dự án (ví dụ: FinTech, mobile health, e-commerce) và sự liên quan của nó.

### 1.2 Problem Statement
Đây là trọng tâm của introduction. Nêu rõ và chính xác:
- Vấn đề, gap, hoặc thách thức mà dự án giải quyết
- Tại sao vấn đề này cần được giải quyết?
- **Phải có citations** cho mọi claim quan trọng

### 1.3 Project Aim
Nêu mục tiêu bao quát duy nhất của dự án trong **một câu**. Đây là giải pháp chính bạn xây dựng.

### 1.4 Specific Objectives
Liệt kê 3–5 objectives theo tiêu chí **SMART**:
- Specific, Measurable, Achievable, Relevant, Time-bound
- Mỗi objective bắt đầu bằng "To + verb"

**Ví dụ:**
- Objective 1: To design and develop a responsive web application for user authentication and profile management.
- Objective 2: To implement a RESTful API for handling data transactions between the client and server.

> ⚠️ **Lưu ý từ Moderator:** SMART objectives phải phản ánh **toàn bộ phạm vi dự án**, không chỉ product build. Đây là lỗi phổ biến nhất.

### 1.5 Scope and Limitations
Xác định rõ ranh giới của dự án:
- **Scope:** Những tính năng nào được bao gồm?
- **Limitations:** Những gì KHÔNG được bao gồm?
- Hãy thực tế về những gì bạn có thể đạt được.

### 1.6 Report Structure
Phác thảo ngắn gọn cấu trúc của phần còn lại của report.

---

## 2. Background and Literature Review

### 2.1 Introduction của Chapter
Bắt đầu bằng:
- **Purpose Statement:** "This chapter critically reviews existing literature and competing solutions to establish the context and justify the need for the proposed project."
- **Scope of Research:** Định nghĩa ranh giới của review.
- **Research Strategy:** Nêu ngắn gọn cách bạn tìm nguồn (ACM Digital Library, IEEE Xplore, Google Scholar...).

### 2.2 Problem Domain Analysis

#### Historical Context and Current Trends
Thảo luận về sự phát triển của domain. Xu hướng kỹ thuật hoặc xã hội nào đang thúc đẩy tầm quan trọng của nó?

#### Key Concepts and Terminology
Định nghĩa các lý thuyết, mô hình, hoặc thuật ngữ kỹ thuật cốt lõi. Đừng giả định người đọc biết tất cả.

#### Significance and Impact
**Dùng số liệu và nguồn uy tín** để cho thấy vấn đề quan trọng như thế nào. Ví dụ: "According to a 2024 study by MarketWatch, food waste accounts for an estimated $1 trillion in economic losses globally..."

### 2.3 Critical Review of Existing Solutions

#### Xác định 2–4 competitors:
- Sản phẩm thương mại, hệ thống tương tự, hoặc công trình nghiên cứu

#### Tạo Comparison Matrix:

| Feature/Aspect | Solution A | Solution B | Solution C | Your Project |
|---|---|---|---|---|
| Target Audience | | | | |
| Core Technology | | | | |
| Key Feature 1 | | | | |
| Key Feature 2 | | | | |
| Strengths | | | | |
| Weaknesses | | | | |

#### Written Analysis (sau bảng):
Không chỉ lặp lại nội dung bảng — hãy **tổng hợp và diễn giải**. Ví dụ: "As the comparison matrix illustrates, a significant gap exists in the market. While Solution A offers comprehensive nutritional data, it lacks the community engagement that makes Solution B successful..."

> ⚠️ **Lưu ý từ Moderator:** Phải có **dedicated product review section** — cụ thể là so sánh hai sản phẩm tương tự sử dụng **Nielsen's heuristics**. Thiếu phần này là lý do lớn dẫn đến điểm thấp.

### 2.4 Critical Review of Enabling Technologies & Methodologies

#### Frontend Frameworks
So sánh ít nhất 2 lựa chọn (React vs. Vue vs. Angular...). Tiêu chí đánh giá: performance, ecosystem, learning curve, sự phù hợp với dự án.

#### Backend Technologies
So sánh Node.js/Express, Python/Django/Flask... Justify dựa trên: tốc độ phát triển, performance, database compatibility.

#### Database Systems
So sánh SQL (PostgreSQL) vs. NoSQL (MongoDB). Giải thích tại sao cấu trúc dữ liệu của dự án phù hợp hơn với loại nào.

#### Development Methodologies
So sánh Agile vs. Waterfall trong bối cảnh dự án của bạn.

### 2.5 Summary and Identification of the Research Gap
**Đây là phần quan trọng nhất của chapter:**

1. **Synthesize:** Tóm tắt ngắn gọn các điểm chính từ review
2. **State the Gap:** Nêu rõ và tự tin: "In summary, the literature review has identified a clear gap: there is no single solution that combines [X] with [Y]..."
3. **Position Your Project:** Dự án của bạn sẽ lấp đầy gap đó như thế nào?

---

## 3. Requirements Analysis

### 3.1 Research Methodology

Đi vào chi tiết:
- Dùng tool gì (Google Forms, SurveyMonkey)?
- Nhận được bao nhiêu responses?
- Demographics chính là gì?
- Nếu phỏng vấn: chọn participants như thế nào?

### 3.2 Market Analysis and User Needs

#### Analysis of Results
Trình bày kết quả chính với **visuals (charts, graphs)** và **diễn giải ý nghĩa**. Ví dụ: "The survey revealed that 78% of respondents were 'frustrated' or 'very frustrated' with existing solutions' user interfaces. This strongly supports our project's focus on streamlined UX/UI design."

#### Detailed User Personas
Xây dựng personas chi tiết với:
- **Image:** Stock photo giúp persona có cảm giác thực
- **Bio:** Đoạn ngắn về cuộc sống và background
- **Goals:** Họ muốn đạt gì liên quan đến dự án của bạn?
- **Frustrations:** Điểm đau với các giải pháp hiện có là gì?
- **Motivations:** Điều gì thúc đẩy họ?

### 3.3 Functional Requirements với MoSCoW Prioritisation

| ID | Description | Priority | Estimation |
|---|---|---|---|
| USR_01 | As a [user], I want [something], so that [why] | Must | 8 days |
| USR_02 | As a [user], I want [something], so that [why] | Should | 2 days |
| ADM_01 | As a [admin], I want [something], so that [why] | Could | 2 days |

**Summary Table:**

| Priority | Number of Features | Number of Days |
|---|---|---|
| Must | X | X |
| Should | X | X |
| Could | X | X |
| **TOTAL** | **X** | **X** |

### 3.4 Non-functional Requirements

| ID | Description |
|---|---|
| NF_01 | Performance: System shall respond to user requests within 2 seconds |
| NF_02 | Security: All passwords shall be hashed using bcrypt |
| NF_03 | Usability: Interface shall comply with WCAG 2.1 AA standards |

---

## 4. Methodology and Project Planning

### 4.1 Development Methodology

Nêu methodology đã chọn (ví dụ: Agile Scrum) và mô tả cách bạn áp dụng thực tế:
- Sprints bao nhiêu tuần?
- Daily standups không?
- Sprint reviews và retrospectives như thế nào?
- Có dùng Kanban board (Trello/GitHub Projects) không?

### 4.2 Project Plan & Timeline

Bao gồm **Gantt chart** trực quan thể hiện các giai đoạn (Discovery, Design, Development Sprints, Testing, Deployment) và milestones chính.

> ⚠️ **Lưu ý từ Moderator:** Gantt chart phải thể hiện:
> - **Parallel backend và frontend activities** (nếu dùng Agile)
> - **Iterative nature của Agile development**
> - **Overlapping tasks** thể hiện concurrent development
> - **Logical dependencies** giữa các tasks
>
> Gantt chart không có những yếu tố trên sẽ không phản ánh đúng Agile và bị trừ điểm.

### 4.3 Feasibility Analysis

Đánh giá ngắn gọn khả năng thực thi của dự án:

- **Technical:** Bạn có kỹ năng và công cụ cần thiết không?
- **Economic:** Chi phí (hosting, APIs) có quản lý được không?
- **Operational:** Giải pháp đề xuất có thể sử dụng và bảo trì được không?

### 4.4 Evaluation Plan & Success Metrics

Xác định tiêu chí thành công **trước** khi bắt đầu build:

- **Quantitative Example:** "Achieve an 80% task completion rate during User Acceptance Testing."
- **Qualitative Example:** "Receive an average user satisfaction rating of 4 out of 5 from test users on a post-test survey."

---

## 5. System Design and Architecture

> 💡 Dùng diagrams nhiều. Một hình ảnh đáng giá ngàn từ.

### 5.1 Rich Picture

Bao gồm rich picture và mô tả ngắn về sản phẩm — thể hiện bức tranh tổng thể của vấn đề và giải pháp.

### 5.2 System Architecture

Cung cấp tổng quan high-level về architecture (Client-Server, Microservices...).

Dùng **C4 Model** làm hướng dẫn:
- **System Context Diagram:** Hệ thống của bạn nằm trong thế giới như thế nào?
- **Container Diagram:** Các khối xây dựng chính (web app, mobile app, database, API).

### 5.3 Technology Stack

Trình bày tech stack đầy đủ trong bảng. Mỗi mục phải có: technology, version, và justification ngắn **với references**.

| Category | Technology | Justification | References |
|---|---|---|---|
| Frontend | React | Fast, component-based UI; large ecosystem | [cite] |
| Backend | Node.js & Express.js | Consistent JS environment; efficient RESTful APIs | [cite] |
| Database | MongoDB Atlas | Flexible NoSQL model; ideal for agile development | [cite] |
| Authentication | JWT | Secure, stateless user authentication | [cite] |
| Version Control | Git & GitHub | Industry standard for source code management | [cite] |
| Deployment | Vercel / Heroku | Simplified continuous deployment | [cite] |
| API Testing | Postman | Essential for testing API endpoints | [cite] |

### 5.4 Detailed Design Diagrams

- **Entity Relationship Diagram (ERD):** Blueprint cho database của bạn
- **UML Diagrams:**
  - **Use Case Diagram:** Thể hiện user interactions
  - **Activity Diagrams:** Model complex workflows
  - **Class Diagrams** (nếu phù hợp)
  - **Sequence Diagrams** (nếu phù hợp)

### 5.5 API Design

Nếu có backend API, document các endpoints chính:

| Id | URL | Method | Description | Params | Returns |
|---|---|---|---|---|---|
| 1 | /reservation | POST | Users reserve parking slot | user_id, garage_id, slot_id | reservation_id |
| 2 | /auth/login | POST | User authentication | email, password | JWT token |
| 3 | /products | GET | Retrieve all products | page, limit | product list |

---

## 6. Implementation

### 6.1 Development Environment

Liệt kê các tools đã sử dụng:
- IDE (VS Code, IntelliJ...)
- Version control (Git/GitHub)
- Project management (Jira, Trello, GitHub Projects)
- Key libraries và dependencies

### 6.2 Backend & Frontend Implementation

- Bao gồm **screenshots của folder structure** và giải thích logic tổ chức
- Ví dụ: "The backend follows a layered architecture with separate folders for controllers, services, and repositories..."
- Cung cấp **code samples có ý nghĩa** — chọn function phức tạp hoặc component cốt lõi
- Dùng code blocks và thêm comments giải thích

> ⚠️ **Lưu ý từ Moderator:** Tránh "excessive screen dumps with limited critical evaluation." Mỗi screenshot/code sample phải đi kèm giải thích, phân tích, hoặc evaluation — không chỉ paste ảnh.

### 6.3 Database Implementation

Giải thích ngắn gọn cách bạn tạo physical database từ ERD. Đề cập đến DBMS (MySQL, PostgreSQL, MongoDB).

### 6.4 Deployment

Mô tả các bước deploy ứng dụng. Bao gồm **screenshots của live, working application**.

Ví dụ: "The application was containerized using Docker and deployed to Heroku. The frontend was deployed to Vercel with continuous deployment configured from the main branch."

### 6.5 Project Management

Bao gồm:
- Screenshots của Trello board hoặc GitHub Projects
- Screenshot của commit history từ GitHub (bằng chứng về consistent work)

> ⚠️ **Lưu ý từ Moderator:** Students nên justify và evaluate product development decisions sử dụng research từ các sections trước — đặc biệt là kết nối với literature review và methodology.

---

## 7. Testing

### 7.1 Testing Strategy

Mô tả các loại testing đã thực hiện:
- **Unit Testing:** Test từng functions/components riêng lẻ
- **Integration Testing:** Đảm bảo các components hoạt động với nhau
- **User Acceptance Testing (UAT):** Test với người dùng thực tế
- **Performance Testing** (nếu có)

### 7.2 Test Cases and Results

Bảng test cases đầy đủ:

| Test ID | Test Description | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| LOGIN01 | Successful Login | 1. Enter valid username. 2. Enter valid password. 3. Click "Login". | User redirected to dashboard. Welcome message shown. | User was redirected. Welcome message displayed. | Pass |
| LOGIN02 | Failed Login (Wrong Password) | 1. Enter valid username. 2. Enter invalid password. 3. Click "Login". | Error message "Invalid username or password" appears. | Specified error message appeared. User not redirected. | Pass |
| LOGIN03 | Failed Login (Empty Username) | 1. Leave username empty. 2. Enter password. 3. Click "Login". | Error message "Username is required" appears. | Specified error message appeared. | Pass |

---

## 8. Legal, Social, Ethical, and Professional Issues (LSEPI)

> ⚠️ **Lưu ý từ Moderator:** Phần LSEPI cần được xử lý đầy đủ, có chiều sâu, với **citations liên quan**. Viết quá ngắn là lỗi phổ biến.

### Legal
- **Data Privacy:** GDPR compliance — thu thập dữ liệu gì? Lưu như thế nào? Có xin consent không?
- **Software Licenses:** Các third-party libraries dùng license gì (MIT, Apache, GPL...)?
- **Copyright:** Có sử dụng media có bản quyền không?
- **Accessibility:** Tuân thủ WCAG 2.1 không?

### Ethical
- Dữ liệu người dùng được xử lý như thế nào một cách đạo đức?
- Có xin informed consent không?
- Dữ liệu có được lưu trữ an toàn không?
- Có bias tiềm ẩn trong thuật toán không (với ML/AI projects)?

### Social
- Tác động xã hội tiềm tàng của dự án là gì?
- Có giúp ích hay gây hại cho nhóm người nào không?
- Dự án có accessible với người dùng khuyết tật không?
- Có tính đến digital divide không?

### Professional
- Các tiêu chuẩn chuyên nghiệp đã tuân thủ: viết code sạch, dùng version control, testing kỹ lưỡng
- Có follow coding best practices không?
- Documentation có đầy đủ không?

---

## 9. Conclusion and Critical Reflection

### 9.1 Summary of Achievements

Kết nối trực tiếp với các goals đặt ra trong Introduction:

**Bảng đánh giá objectives:**

| Objective (từ Chapter 1) | Met? | Evidence / Outcome |
|---|---|---|
| To design and develop a user authentication system | Yes | Fully functional login/registration using JWT. Users can create accounts and log in successfully. |
| To implement a RESTful API for data transactions | Yes | Over 20 API endpoints created and documented with Swagger. |
| To build a responsive frontend for profile management | Partially | Profile dashboard functional on desktop but requires optimization for mobile. |

### 9.2 Critical Project Evaluation

Thể hiện critical thinking bằng cách phân tích trung thực quá trình và kết quả.

#### Successes and Strengths (What Went Well)
- Thảo luận những khía cạnh thành công nhất
- Lựa chọn technology nào đặc biệt hiệu quả?
- Quyết định design/architecture nào hoạt động tốt?

Ví dụ: "Choosing Flutter for the mobile app proved to be an excellent decision, as it significantly accelerated development time and provided a consistent UI across platforms."

#### Challenges and Weaknesses (What Didn't Go Well)
- Thành thật về những khó khăn — thể hiện sự trưởng thành
- Có underestimate độ phức tạp của feature nào không?
- Library nào có limitations không ngờ tới?
- Thảo luận cách bạn xử lý những thách thức đó

Ví dụ: "Implementing the real-time chat feature was far more complex than anticipated, leading to a two-week delay. This was addressed by reducing the scope of the feature in Sprint 3 to focus on core messaging functionality."

### 9.3 Personal Reflection and Key Learnings

Tập trung vào sự phát triển cá nhân:

- **What You Learned:** Cụ thể, không mơ hồ. Không chỉ "I learned React" — thay vào đó: "I developed a deep understanding of React's component lifecycle and state management using Redux, enabling me to build complex, scalable UIs."
- **Skills Developed:** Không chỉ kỹ năng kỹ thuật — cả project management, time management, problem-solving
- **What You Would Do Differently:** Nếu bắt đầu lại, bạn sẽ thay đổi gì?

Ví dụ: "I would have spent more time on database design initially to avoid the need for schema migrations later in the project, which consumed approximately one full sprint."

### 9.4 Recommendations for Future Development

Lộ trình cho những gì có thể làm tiếp:

- **Feature Enhancements:** 2–3 tính năng cụ thể sẽ tạo giá trị cao
- **Technical Improvements:** Cách cải thiện về mặt kỹ thuật (caching, refactoring, test coverage)
- **Scalability:** Cách chuẩn bị ứng dụng xử lý nhiều users/data hơn

### 9.5 Final Conclusion

Đoạn ngắn, mạnh mẽ kết thúc toàn bộ report:
- Nhắc lại core problem statement từ introduction
- Tóm tắt giải pháp và đóng góp/sự sáng tạo chính
- Kết thúc bằng câu forward-looking về giá trị và tiềm năng tác động

Ví dụ: "In conclusion, this project successfully addressed the gap in the market for an intuitive student-focused planning tool. By integrating task management and scheduling into a single platform, the developed prototype provides a robust foundation for a product that could significantly enhance student productivity and organization."

---

## 10. References

> ⚠️ **Cực kỳ quan trọng: References chiếm 20% số điểm!**

- Dùng **Harvard referencing style** nhất quán
- Cite **tất cả** academic papers, articles, websites đã sử dụng
- In-text citations phải khớp với reference list
- Tất cả claims quan trọng phải có citations, đặc biệt trong:
  - Problem Statement
  - Literature Review
  - Methodology
  - LSEPI

---

## 11. Appendix A — Project Proposal

Bao gồm Project Proposal gốc ở đây để tham khảo.

---

## 12. Appendix B — Images of Final Product

Bao gồm hình ảnh của sản phẩm cuối cùng ở đây để tham khảo.

---

## Checklist trước khi nộp Final Report

```
[ ] Cover Page — Đủ thông tin (tên, ID, supervisor, ngày nộp, word count)
[ ] Abstract — 200-350 từ, tự viết
[ ] Acknowledgements — Cảm ơn đúng người
[ ] Introduction — Problem statement có citations, SMART objectives đủ
[ ] Literature Review — Critical analysis, Comparison matrix, Nielsen's heuristics, gap identified
[ ] Requirements — MoSCoW table, Non-functional requirements, User personas
[ ] Methodology — Gantt chart Agile-aware, Development methodology có justification
[ ] System Design — Rich picture, C4 diagrams, ERD, UML, API design table, Tech stack với refs
[ ] Implementation — Folder structure, code samples có explanation, deployment screenshots
[ ] Testing — Test cases table đầy đủ với Pass/Fail results
[ ] LSEPI — Đầy đủ 4 khía cạnh, có citations, có chiều sâu
[ ] Conclusion — Evaluation table cho objectives, critical reflection, future work
[ ] References — Harvard style, đầy đủ, ≥15 nguồn
[ ] Appendices — Proposal và product images
[ ] Grammar & Formatting — Third person, proof-read, format nhất quán
```

---

## Ghi chú từ Moderator (2025/2026)

Dựa trên feedback của Moderator Aditi Rawal (23 Jan 2026) cho Final Report, các vấn đề chính:

- **SMART objectives phải phản ánh full scope** — không chỉ product build
- **Cần có dedicated product review section** — so sánh 2 sản phẩm tương tự dùng **Nielsen's heuristics**
- **Gantt chart phải thể hiện Agile** — concurrent task development với clear interdependencies
- **Tránh screen dumps quá nhiều** — mỗi ảnh phải có critical evaluation đi kèm
- **Justify product development decisions** bằng research từ các sections trước
- Wireframes, user stories, và detailed test planning được đánh giá cao
- Nhiều bài có chất lượng tốt về wireframes, user stories — tiếp tục phát huy
- **Marks would be better reflected** nếu SMART objectives phản ánh toàn bộ project scope

---

## Viết Report theo Third Person (Academic Style)

> ⚠️ **Lưu ý từ Moderator:** Bài đạt 80% phải được viết ở third person.

**Sai (First Person):**
> "I designed the system using a microservices architecture."

**Đúng (Third Person):**
> "The system was designed using a microservices architecture."
> "This project adopted a microservices architecture for the following reasons..."
> "The developer implemented the authentication module using JWT..."

---

## Tips bổ sung để đạt điểm cao

1. **Kết nối các phần với nhau** — Literature Review dẫn đến Requirements; Methodology dẫn đến Implementation; Testing kết nối với Evaluation Plan
2. **Trích dẫn nghiên cứu** khi justify technical decisions trong Implementation — không chỉ nói "I chose X because it's popular"
3. **Evaluation phải trung thực** — thừa nhận điểm chưa tốt thể hiện critical thinking, không phải điểm yếu
4. **Wireframes và User Stories** được moderator đánh giá rất cao
5. **Test planning chi tiết** với đa dạng loại tests (unit, integration, UAT) là điểm cộng lớn
6. **References chiếm 20% điểm** — đừng để đây là phần làm qua loa cuối cùng

# StudyMate — Academic Learning Platform

StudyMate is a comprehensive academic networking and learning platform for students across multiple educational disciplines (Computer Science, Cybersecurity, AI/ML, Data Science, Electrical, Mechanical, Civil, Mathematics, and more).

---

## 🚀 Key Feature Dashboards

1. **Shared Notes**: Multi-domain academic notes discovery with domain filters, full-text search, previews, and access-controlled downloads.
2. **Upload Notes**: Secure document upload (PDF, DOCX, PPTX, TXT, PNG, JPEG, max 25MB) with path-traversal protection, domain classification, and self-service edit/delete management for your uploads.
3. **Course Discovery**: Multi-domain academic curriculum catalogue across foundational, undergraduate, and postgraduate levels, linking subjects to notes, quizzes, and flashcards.
4. **Study Library**: Searchable repository of verified open-access educational textbooks, lecture notes, and question banks.
5. **Daily Goals with Reminders**: Personal study target tracker with reminder dates/times, in-app notifications, overdue tracking, and automated reminder cancellation on goal completion.
6. **Domain-Based Quizzes**: Interactive practice assessments across engineering and science domains with scoring and rationales.
7. **Domain-Based Flashcards**: 3D flip card viewer, deck creator, and mastery tracking (Known / Needs Revision).
8. **Community Q&A (Private Student Support & Admin Console)**:
   - **Student View**: Submit academic doubts, technical issues, or platform requests privately. Strictly visible only to the submitting student and authorized administrators.
   - **Admin Console**: Verified administrators can view all student queries, update ticket status (`Open`, `In Progress`, `Waiting for Student`, `Answered`, `Resolved`, `Closed`), post official replies, and maintain internal notes completely hidden from students.
   - **Admin Security**: Server-verified role checks (`adminOnly` middleware) return HTTP 403 on unauthorized attempts; ordinary students cannot modify roles.
9. **Find Partner & Chat**: Academic peer matching based on department and subjects, with real-time direct messaging and an integrated AI study assistant inside chat.

*(Note: The standalone Learning Hub and extra AI assistant dashboard have been cleanly retired from visible navigation while preserving all backend and chat AI functionality.)*

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3, Vanilla JavaScript (no heavy frontend frameworks).
- **Backend**: Node.js & Express.js.
- **Database**: Local MySQL (with resilient in-memory storage fallback for local development when MySQL is offline).
- **Authentication**: Email/password authentication with server-side managed Express sessions.

---

## 💾 Database Setup & Migrations

To apply the database schema and enhanced dashboard migrations to your local MySQL server:

1. **Base Schema**:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
2. **Migration 004 (Enhanced Dashboards & Admin Security)**:
   ```bash
   mysql -u root -p studymate_db < database/migrations/004_enhanced_academic_dashboards.sql
   ```

*Rollback*: If needed, you can drop the added tables (`support_queries`, `support_responses`, `admin_internal_notes`, `library_books`, `academic_domains`) and alter `users` to remove `role`.

---

## 🛡️ Administrator Provisioning

Administrator access is strictly protected on the backend:
- To provision an administrator in MySQL, run:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'your_admin_email@example.com';
  ```
- In the local development fallback mode:
  - The default administrator account is `test@test.com` (password: `password`).
  - Any email containing `admin@` is also automatically provisioned as an admin during registration.
  - All standard student registrations receive `role: 'student'`.

---

## 📂 File Storage Configuration

- Uploaded files are stored in `backend/uploads/` on the local filesystem.
- Uploads are validated by MIME type and file extension (PDF, DOCX, PPTX, TXT, PNG, JPEG).
- Max file size is capped at 25MB.
- File downloads are protected via `/api/notes/download/:id` and `/api/materials/:id/download`.
- The `backend/uploads/` folder is excluded from Git to prevent committing student documents.

---

## 🏃 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment**:
   Create a `.env` file in the root directory (or use default development fallbacks):
   ```ini
   PORT=3000
   SESSION_SECRET=studymate_secret_session_key
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=studymate_db
   ```
3. **Start the server**:
   ```bash
   npm run dev
   # or
   node backend/server.js
   ```
4. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🧪 Running Automated Tests

A comprehensive test suite is included to verify all 8 dashboards, authentication, admin authorization, and regression safety:
```bash
node tests/test_enhanced_dashboards.js
```
The test suite verifies 32 automated test assertions across all functional modules.

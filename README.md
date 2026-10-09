# StudyMate - Local Express & MySQL Architecture

StudyMate has been fully migrated from Zoho Catalyst to a completely local environment utilizing Node.js, Express, and MySQL Community Server.

## Prerequisites
- **Node.js**: v18+
- **npm**: v9+
- **MySQL Community Server**: v8+

## 1. Database Setup
1. Log into your local MySQL server (e.g., using MySQL Workbench or CLI).
2. Run the `database/schema.sql` file to create the `studymate_db` and its tables.
   ```bash
   mysql -u root -p < database/schema.sql
   ```
*(Replace `root` with your local MySQL username if different).*

## 2. Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Update `.env` with your actual MySQL credentials:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=studymate_db
SESSION_SECRET=a_very_secure_secret_key
PORT=3000
```

## 3. Installation
Install all backend and frontend dependencies by running this in the project root:
```bash
npm install
```

## 4. Run the Application
Start the Node.js server:
```bash
npm run dev
```

## 5. Usage
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

You can register an account directly on the landing page, log in, and use the full dashboard. All requests will be securely routed via standard Express Session cookies.

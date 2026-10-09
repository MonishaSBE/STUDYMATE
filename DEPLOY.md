# Deployment & Operations Guide

## Application Architecture
- **Frontend**: Static files (HTML, CSS, JS) served out of the `frontend/` directory by Express.
- **Backend**: Node.js Express server (`backend/server.js`) providing JSON API routes.
- **Database**: MySQL serving normalized tables via `mysql2` connections.
- **Authentication**: Native bcrypt password hashing combined with `express-session` backed by `express-mysql-session`.

## Security Features Enabled
- Sessions use `HttpOnly` and `SameSite: lax` configurations.
- SQL operations use strict parameterized arrays to prevent SQL injection.
- User requests (like goals and profile changes) always pull user authentication from the secure `req.session.userId`, rendering user impersonation via the frontend impossible.
- Passwords are salted and hashed natively; plaintext is never stored.

## Local Server Starting
Run:
`npm start` (for production single-threaded) or `npm run dev` (for development monitoring).

## Validating Functionality
1. **Auth**: Try signing up multiple users (e.g., test1@example.com, test2@example.com).
2. **Profile**: Update profiles on both accounts.
3. **Group Creation**: Creating a group adds an entry to `study_groups` and immediately enrolls the user in `group_members`.
4. **Chat Requests**: Using the matching engine, hitting 'send request' securely populates `chat_requests`.

## Removing Catalyst
Every single Catalyst dependency (`catalyst.json`, `client-package.json`, Catalyst CDN links) has been systematically deleted. There is no cloud telemetry attached to this app.

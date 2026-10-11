-- ============================================================
-- StudyMate Real-Time Messaging & Direct Chat Schema Extension
-- ============================================================

USE studymate_db;

-- 1. CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('direct', 'group', 'ai') DEFAULT 'direct',
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. CONVERSATION PARTICIPANTS
CREATE TABLE IF NOT EXISTS conversation_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    student_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP NULL,
    UNIQUE KEY uq_conv_student (conversation_id, student_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
    INDEX idx_student_conv (student_id)
);

-- 3. DIRECT MESSAGES
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL, -- references student_profiles(id) or 0 for AI
    sender_name VARCHAR(255),
    content TEXT NOT NULL,
    message_type ENUM('text', 'ai_academic', 'system') DEFAULT 'text',
    status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conv_time (conversation_id, created_at)
);

-- 4. INTRODUCTORY MESSAGE ON CHAT REQUESTS
-- Add intro_message column to chat_requests if not exists
ALTER TABLE chat_requests ADD COLUMN IF NOT EXISTS intro_message TEXT;

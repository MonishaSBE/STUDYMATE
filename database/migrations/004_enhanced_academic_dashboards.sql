-- ============================================================
-- StudyMate Multi-Domain Academic Platform Enhancement Migration
-- Migration: 004_enhanced_academic_dashboards.sql
-- ============================================================

USE studymate_db;

-- 1. ADD ROLE TO USERS TABLE FOR ADMIN AUTHORIZATION
ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('student', 'admin') DEFAULT 'student';

-- 2. ENHANCE SHARED NOTES TABLE
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS domain VARCHAR(100) DEFAULT 'Computer Science';
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS subject VARCHAR(100);
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50);
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS resource_type VARCHAR(50) DEFAULT 'lecture_notes';
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS file_path VARCHAR(1024);
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS file_size INT DEFAULT 0;
ALTER TABLE shared_notes ADD COLUMN IF NOT EXISTS visibility ENUM('public', 'group_only', 'private') DEFAULT 'public';

-- 3. ENHANCE STUDY GOALS TABLE WITH REMINDERS
ALTER TABLE study_goals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE study_goals ADD COLUMN IF NOT EXISTS reminder_datetime DATETIME NULL;
ALTER TABLE study_goals ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL;
ALTER TABLE study_goals ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- 4. EDUCATIONAL DOMAINS
CREATE TABLE IF NOT EXISTS academic_domains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(20) DEFAULT '📚',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. LIBRARY EDUCATIONAL BOOKS & KNOWLEDGE RESOURCES
CREATE TABLE IF NOT EXISTS library_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    publisher VARCHAR(255),
    publication_year INT,
    domain VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subject VARCHAR(100),
    description TEXT,
    resource_type VARCHAR(50) DEFAULT 'Open Access Book',
    access_url VARCHAR(1024),
    license_type VARCHAR(100) DEFAULT 'Open Educational Resource / Public Access',
    local_file_path VARCHAR(1024),
    cover_color VARCHAR(20) DEFAULT '#2f8f8a',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_book_domain (domain),
    INDEX idx_book_category (category)
);

CREATE TABLE IF NOT EXISTS library_bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_book_bookmark (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE
);

-- 6. PRIVATE SUPPORT & QUERY RESOLUTION SYSTEM (ADMIN-ONLY VISIBILITY)
CREATE TABLE IF NOT EXISTS support_queries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    student_name VARCHAR(255),
    student_email VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM(
        'academic_doubt',
        'programming_error',
        'study_resource_issue',
        'quiz_flashcard_issue',
        'account_issue',
        'technical_issue',
        'feature_request',
        'other'
    ) NOT NULL DEFAULT 'academic_doubt',
    status ENUM(
        'open',
        'in_progress',
        'waiting_for_student',
        'answered',
        'resolved',
        'closed'
    ) NOT NULL DEFAULT 'open',
    attachment_path VARCHAR(1024),
    attachment_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_query_user (user_id),
    INDEX idx_query_status (status)
);

CREATE TABLE IF NOT EXISTS support_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query_id INT NOT NULL,
    sender_id INT NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_role ENUM('student', 'admin') NOT NULL,
    message TEXT NOT NULL,
    attachment_path VARCHAR(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES support_queries(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_internal_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query_id INT NOT NULL,
    admin_id INT NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES support_queries(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. SEED ACADEMIC DOMAINS
INSERT IGNORE INTO academic_domains (name, code, description, icon) VALUES
('Computer Science and Engineering', 'CSE', 'Algorithms, systems, software engineering, databases, and core computing foundations.', '💻'),
('Cybersecurity', 'CYBER', 'Network defense, cryptography, penetration testing, threat intelligence, and security operations.', '🛡️'),
('Artificial Intelligence and Machine Learning', 'AIML', 'Neural networks, machine learning models, natural language processing, and computer vision.', '🤖'),
('Data Science', 'DS', 'Statistical modeling, big data analytics, data visualization, and exploratory research.', '📊'),
('Information Technology', 'IT', 'Enterprise computing, cloud infrastructure, systems administration, and web applications.', '🌐'),
('Electronics and Communication Engineering', 'ECE', 'Embedded systems, digital signal processing, VLSI design, and telecommunications.', '📡'),
('Electrical and Electronics Engineering', 'EEE', 'Power systems, circuit analysis, control systems, and power electronics.', '⚡'),
('Mechanical Engineering', 'MECH', 'Thermodynamics, fluid mechanics, CAD/CAM, structural mechanics, and manufacturing.', '⚙️'),
('Civil Engineering', 'CIVIL', 'Structural analysis, geotechnical engineering, hydraulics, and urban planning.', '🏗️'),
('Business and Management', 'MGMT', 'Operations research, financial management, strategic planning, and business analytics.', '📈'),
('Mathematics', 'MATH', 'Discrete mathematics, linear algebra, calculus, probability, and optimization theory.', '📐'),
('Physics', 'PHYS', 'Classical mechanics, quantum physics, electromagnetism, and applied materials.', '🔬'),
('Chemistry', 'CHEM', 'Physical chemistry, organic synthesis, analytical instrumentation, and computational chemistry.', '🧪');

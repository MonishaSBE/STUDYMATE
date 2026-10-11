-- ============================================================
-- StudyMate Academic Platform Enhancement Migration
-- Additive Schema: Institution Discovery, Study Library,
-- Quizzes, Flashcards, Concept Maps, Community Q&A
-- ============================================================

USE studymate_db;

-- 1. INSTITUTIONS & COURSE CATALOGUE
CREATE TABLE IF NOT EXISTS institutions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50),
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    institution_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_inst_dept (institution_id, code)
);

CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    semester INT NOT NULL,
    academic_year VARCHAR(50),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    INDEX idx_course_lookup (department_id, semester)
);

-- 2. STUDY MATERIALS & METADATA
CREATE TABLE IF NOT EXISTS study_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id INT,
    institution_id INT,
    subject_name VARCHAR(255) NOT NULL,
    resource_type ENUM(
        'lecture_notes',
        'pdf_document',
        'class_notes',
        'subject_summary',
        'question_bank',
        'previous_exam',
        'lab_record',
        'assignment_prep',
        'revision_sheet',
        'reference_link',
        'study_guide'
    ) NOT NULL DEFAULT 'lecture_notes',
    examination_type VARCHAR(100) DEFAULT 'University Semester Exam',
    file_path VARCHAR(1024),
    file_name VARCHAR(255),
    file_size INT DEFAULT 0,
    mime_type VARCHAR(100),
    uploaded_by INT NOT NULL,
    views_count INT DEFAULT 0,
    downloads_count INT DEFAULT 0,
    is_moderated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES student_profiles(id) ON DELETE CASCADE,
    INDEX idx_mat_subject (subject_name),
    INDEX idx_mat_type (resource_type)
);

CREATE TABLE IF NOT EXISTS material_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    tag VARCHAR(100) NOT NULL,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE,
    INDEX idx_tag (tag)
);

CREATE TABLE IF NOT EXISTS material_bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    material_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_bookmark (user_id, material_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS material_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    material_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_material_rating (user_id, material_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    material_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status ENUM('pending', 'reviewed', 'dismissed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    material_id INT NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE
);

-- 3. AI DOCUMENTS & CONVERSATIONS
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    material_id INT,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    source_reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

-- 4. QUIZZES & ASSESSMENTS
CREATE TABLE IF NOT EXISTS quizzes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    material_id INT,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    num_questions INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('mcq', 'true_false', 'fill_blank', 'short_answer') DEFAULT 'mcq',
    options_json JSON,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    user_id INT NOT NULL,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    details_json JSON,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. FLASHCARDS
CREATE TABLE IF NOT EXISTS flashcard_decks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    material_id INT,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS flashcards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deck_id INT NOT NULL,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcard_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    card_id INT NOT NULL,
    mastery_status ENUM('unseen', 'learning', 'mastered') DEFAULT 'unseen',
    last_reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_card (user_id, card_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE
);

-- 6. CONCEPT MAPS
CREATE TABLE IF NOT EXISTS concept_maps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    material_id INT,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    nodes_json JSON NOT NULL,
    edges_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE SET NULL
);

-- 7. COMMUNITY QUESTIONS & ANSWERS
CREATE TABLE IF NOT EXISTS community_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags VARCHAR(255),
    is_resolved BOOLEAN DEFAULT FALSE,
    views_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    is_accepted BOOLEAN DEFAULT FALSE,
    upvotes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES community_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    answer_id INT NOT NULL,
    vote_type ENUM('up', 'down') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_vote (user_id, answer_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (answer_id) REFERENCES community_answers(id) ON DELETE CASCADE
);

-- 8. INITIAL SAMPLE CATALOGUE DATA (RMK College of Engineering and Technology)
INSERT IGNORE INTO institutions (id, name, code, location) VALUES
(1, 'RMK College of Engineering and Technology', 'RMKCET', 'Puduvoyal, Tamil Nadu');

INSERT IGNORE INTO departments (id, institution_id, name, code) VALUES
(1, 1, 'Computer Science and Engineering', 'CSE'),
(2, 1, 'Computer Science & Engineering (Cyber Security)', 'CSE-CYBER');

-- Sample Core & Cyber Subjects across Semesters
INSERT IGNORE INTO courses (id, department_id, course_name, course_code, semester, academic_year) VALUES
(1, 1, 'Data Structures and Algorithms', 'CS3301', 3, '2nd Year'),
(2, 1, 'Database Management Systems', 'CS3492', 4, '2nd Year'),
(3, 1, 'Design and Analysis of Algorithms', 'CS3401', 4, '2nd Year'),
(4, 1, 'Operating Systems', 'CS3451', 4, '2nd Year'),
(5, 1, 'Computer Networks', 'CS3591', 5, '3rd Year'),
(6, 1, 'Compiler Design', 'CS3501', 5, '3rd Year'),
(7, 1, 'Artificial Intelligence and Machine Learning', 'CS3691', 6, '3rd Year'),
(8, 1, 'Cloud Computing and DevOps', 'CS3701', 7, '4th Year'),
(9, 2, 'Foundations of Cyber Security', 'CB3301', 3, '2nd Year'),
(10, 2, 'Cryptography and Network Security', 'CB3401', 4, '2nd Year'),
(11, 2, 'Ethical Hacking and Penetration Testing', 'CB3501', 5, '3rd Year'),
(12, 2, 'Digital Forensics and Incident Response', 'CB3601', 6, '3rd Year'),
(13, 2, 'Cyber Threat Intelligence & SOC Operations', 'CB3701', 7, '4th Year');

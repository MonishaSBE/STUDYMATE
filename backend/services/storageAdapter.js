const pool = require('../config/database');
const mockDb = require('../mockDb');

/**
 * StorageAdapter provides an unified data access layer:
 * If MySQL is connected, queries run directly on MySQL.
 * If MySQL is unreachable, it seamlessly operates on an in-memory/fallback store
 * that mirrors the exact same relational contracts so that development and demo execution NEVER crash.
 */

// In-memory data store for academic platform entities
const fallbackData = {
    institutions: [
        { id: 1, name: 'RMK College of Engineering and Technology', code: 'RMKCET', location: 'Puduvoyal, Tamil Nadu' }
    ],
    departments: [
        { id: 1, institution_id: 1, name: 'Computer Science and Engineering', code: 'CSE' },
        { id: 2, institution_id: 1, name: 'Computer Science & Engineering (Cyber Security)', code: 'CSE-CYBER' }
    ],
    courses: [
        { id: 1, department_id: 1, course_name: 'Data Structures and Algorithms', course_code: 'CS3301', semester: 3, academic_year: '2nd Year' },
        { id: 2, department_id: 1, course_name: 'Database Management Systems', course_code: 'CS3492', semester: 4, academic_year: '2nd Year' },
        { id: 3, department_id: 1, course_name: 'Design and Analysis of Algorithms', course_code: 'CS3401', semester: 4, academic_year: '2nd Year' },
        { id: 4, department_id: 1, course_name: 'Operating Systems', course_code: 'CS3451', semester: 4, academic_year: '2nd Year' },
        { id: 5, department_id: 1, course_name: 'Computer Networks', course_code: 'CS3591', semester: 5, academic_year: '3rd Year' },
        { id: 6, department_id: 1, course_name: 'Compiler Design', course_code: 'CS3501', semester: 5, academic_year: '3rd Year' },
        { id: 7, department_id: 1, course_name: 'Artificial Intelligence and Machine Learning', course_code: 'CS3691', semester: 6, academic_year: '3rd Year' },
        { id: 8, department_id: 1, course_name: 'Cloud Computing and DevOps', course_code: 'CS3701', semester: 7, academic_year: '4th Year' },
        { id: 9, department_id: 2, course_name: 'Foundations of Cyber Security', course_code: 'CB3301', semester: 3, academic_year: '2nd Year' },
        { id: 10, department_id: 2, course_name: 'Cryptography and Network Security', course_code: 'CB3401', semester: 4, academic_year: '2nd Year' },
        { id: 11, department_id: 2, course_name: 'Ethical Hacking and Penetration Testing', course_code: 'CB3501', semester: 5, academic_year: '3rd Year' },
        { id: 12, department_id: 2, course_name: 'Digital Forensics and Incident Response', course_code: 'CB3601', semester: 6, academic_year: '3rd Year' },
        { id: 13, department_id: 2, course_name: 'Cyber Threat Intelligence & SOC Operations', course_code: 'CB3701', semester: 7, academic_year: '4th Year' }
    ],
    materials: [
        {
            id: 1,
            title: 'CS3301 DSA Comprehensive Revision Guide & Practice Problems',
            description: 'Complete unit-wise coverage of Trees, Graphs, Sorting algorithms and asymptotic complexity analysis.',
            course_id: 1,
            institution_id: 1,
            subject_name: 'Data Structures and Algorithms',
            resource_type: 'revision_sheet',
            examination_type: 'University Semester Exam',
            file_path: null,
            file_name: 'CS3301_DSA_Revision_Guide.pdf',
            file_size: 2450000,
            mime_type: 'application/pdf',
            uploaded_by: 1,
            uploader_name: 'Alex Johnson',
            views_count: 84,
            downloads_count: 32,
            is_moderated: true,
            tags: ['Trees', 'Graphs', 'Time Complexity', 'Algorithms'],
            created_at: new Date(Date.now() - 86400000 * 3).toISOString()
        },
        {
            id: 2,
            title: 'CB3401 Cryptography & Network Security Question Bank with Solutions',
            description: 'Model question bank containing 2-mark and 13-mark solved problems on AES, RSA, Diffie-Hellman and SHA-256.',
            course_id: 10,
            institution_id: 1,
            subject_name: 'Cryptography and Network Security',
            resource_type: 'question_bank',
            examination_type: 'Model Examination',
            file_path: null,
            file_name: 'CB3401_Crypto_QB_Solved.pdf',
            file_size: 3820000,
            mime_type: 'application/pdf',
            uploaded_by: 2,
            uploader_name: 'Sam Smith',
            views_count: 142,
            downloads_count: 65,
            is_moderated: true,
            tags: ['Cryptography', 'RSA', 'AES', 'Cyber Security'],
            created_at: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
            id: 3,
            title: 'CS3492 DBMS Unit 3 & 4 Normalization & Transaction Processing Notes',
            description: 'Concise lecture notes detailing 1NF to BCNF decompositions, ACID properties, and Concurrency Control protocols.',
            course_id: 2,
            institution_id: 1,
            subject_name: 'Database Management Systems',
            resource_type: 'lecture_notes',
            examination_type: 'University Semester Exam',
            file_path: null,
            file_name: 'CS3492_DBMS_Unit3_4_Notes.pdf',
            file_size: 1940000,
            mime_type: 'application/pdf',
            uploaded_by: 3,
            uploader_name: 'Taylor Doe',
            views_count: 98,
            downloads_count: 41,
            is_moderated: true,
            tags: ['DBMS', 'SQL', 'Normalization', 'Transactions'],
            created_at: new Date(Date.now() - 86400000 * 1).toISOString()
        }
    ],
    bookmarks: [
        { id: 1, user_id: 1, material_id: 2, created_at: new Date().toISOString() }
    ],
    ratings: [
        { id: 1, user_id: 1, material_id: 2, rating: 5, review: 'Extremely helpful for solving RSA and Diffie-Hellman numericals!', created_at: new Date().toISOString() },
        { id: 2, user_id: 2, material_id: 1, rating: 5, review: 'Clear visual tree rotation steps.', created_at: new Date().toISOString() }
    ],
    reports: [],
    quizzes: [
        {
            id: 1,
            user_id: 1,
            material_id: 1,
            title: 'Data Structures Mastery Quiz',
            subject: 'Data Structures and Algorithms',
            difficulty: 'medium',
            num_questions: 4,
            created_at: new Date().toISOString(),
            questions: [
                {
                    id: 1,
                    question_text: 'What is the worst-case time complexity of searching in a standard Binary Search Tree (BST)?',
                    question_type: 'mcq',
                    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
                    correct_answer: 'O(n)',
                    explanation: 'In the worst case, a BST degenerates into a linked list (skewed tree), taking O(n) time.'
                },
                {
                    id: 2,
                    question_text: 'An AVL tree is a self-balancing binary search tree where the difference between heights of left and right subtrees cannot be more than 1.',
                    question_type: 'true_false',
                    options: ['True', 'False'],
                    correct_answer: 'True',
                    explanation: 'The balance factor in an AVL tree must always be -1, 0, or +1.'
                },
                {
                    id: 3,
                    question_text: 'Which data structure uses LIFO (Last-In-First-Out) ordering?',
                    question_type: 'mcq',
                    options: ['Queue', 'Stack', 'Array', 'Heap'],
                    correct_answer: 'Stack',
                    explanation: 'A stack operates on a LIFO discipline.'
                },
                {
                    id: 4,
                    question_text: 'Breadth-First Search (BFS) on graphs is typically implemented using a ______ queue.',
                    question_type: 'fill_blank',
                    options: ['FIFO', 'LIFO', 'Priority', 'Circular'],
                    correct_answer: 'FIFO',
                    explanation: 'BFS uses a standard FIFO queue to explore nodes level-by-level.'
                }
            ]
        }
    ],
    quiz_attempts: [
        { id: 1, quiz_id: 1, user_id: 1, score: 4, total_questions: 4, attempted_at: new Date().toISOString() }
    ],
    flashcard_decks: [
        {
            id: 1,
            user_id: 1,
            subject: 'Cryptography & Security',
            title: 'Core Cryptography Terminology',
            description: 'Essential symmetric vs asymmetric concepts and hashing algorithms.',
            is_public: true,
            created_at: new Date().toISOString(),
            cards: [
                { id: 1, deck_id: 1, front_text: 'What is the primary difference between symmetric and asymmetric encryption?', back_text: 'Symmetric encryption uses the same private key for encryption and decryption (e.g. AES). Asymmetric uses a public key to encrypt and a private key to decrypt (e.g. RSA).' },
                { id: 2, deck_id: 1, front_text: 'What is the avalanche effect in cryptographic hash functions?', back_text: 'A desirable property where a slight change in input (even 1 single bit) changes the output hash dramatically.' },
                { id: 3, deck_id: 1, front_text: 'What is Diffie-Hellman Key Exchange used for?', back_text: 'A cryptographic protocol that allows two parties to securely establish a shared secret key over an insecure channel.' }
            ]
        }
    ],
    flashcard_progress: {},
    concept_maps: [
        {
            id: 1,
            user_id: 1,
            subject: 'Database Systems',
            title: 'Relational Database Architecture',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            nodes: [
                { id: '1', label: 'Relational DBMS', category: 'root' },
                { id: '2', label: 'ACID Properties', category: 'core' },
                { id: '3', label: 'Normalization', category: 'core' },
                { id: '4', label: 'Atomicity & Consistency', category: 'detail' },
                { id: '5', label: 'Isolation & Durability', category: 'detail' },
                { id: '6', label: '1NF, 2NF, 3NF, BCNF', category: 'detail' },
                { id: '7', label: 'Indexing (B-Trees)', category: 'performance' }
            ],
            edges: [
                { from: '1', to: '2', relation: 'ensures' },
                { from: '1', to: '3', relation: 'structured via' },
                { from: '2', to: '4', relation: 'guarantees' },
                { from: '2', to: '5', relation: 'maintains' },
                { from: '3', to: '6', relation: 'progresses through' },
                { from: '1', to: '7', relation: 'optimized by' }
            ]
        }
    ],
    community_questions: [
        {
            id: 1,
            user_id: 2,
            author_name: 'Sam Smith',
            subject: 'Operating Systems',
            title: 'Why is Banker’s Algorithm rarely implemented in general-purpose operating systems?',
            content: 'In our OS class we learned that Banker\'s Algorithm avoids deadlocks by simulating allocation of pre-declared maximum resources. Why do modern OS like Linux or Windows prefer detection or recovery instead of strict avoidance?',
            tags: 'Deadlock, Bankers Algorithm, OS, Concurrency',
            is_resolved: true,
            views_count: 57,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            answers: [
                {
                    id: 1,
                    question_id: 1,
                    user_id: 1,
                    author_name: 'Alex Johnson',
                    content: 'In practice, processes cannot reliably know or declare their maximum resource requirement in advance. Furthermore, process count and resource availability dynamically fluctuate in multi-tenant systems, making the constant O(m * n^2) simulation overhead prohibitively expensive.',
                    is_accepted: true,
                    upvotes: 6,
                    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
                }
            ]
        },
        {
            id: 2,
            user_id: 3,
            author_name: 'Taylor Doe',
            subject: 'Design and Analysis of Algorithms',
            title: 'When should we use Dynamic Programming vs Greedy Strategy?',
            content: 'I frequently get confused during exam problem formulation whether a problem exhibits optimal substructure with overlapping subproblems or if a greedy choice property suffices.',
            tags: 'Algorithms, Dynamic Programming, Greedy, Optimization',
            is_resolved: false,
            views_count: 42,
            created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
            answers: []
        }
    ],
    community_votes: {},
    ai_conversations: [],
    nextId: 100
};

// Check if MySQL is available
let isMySqlAvailable = false;
pool.query('SELECT 1')
    .then(() => {
        isMySqlAvailable = true;
        console.log('[StorageAdapter] MySQL connection is active.');
    })
    .catch(err => {
        isMySqlAvailable = false;
        console.log('[StorageAdapter] MySQL offline or not reachable. Using resilient in-memory storage fallback.');
    });

module.exports = {
    fallbackData,
    isMySqlAvailable: () => isMySqlAvailable,
    pool
};

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
    academic_domains: [
        { id: 1, name: 'Computer Science and Engineering', code: 'CSE', icon: '💻' },
        { id: 2, name: 'Cybersecurity', code: 'CYBER', icon: '🛡️' },
        { id: 3, name: 'Artificial Intelligence and Machine Learning', code: 'AIML', icon: '🤖' },
        { id: 4, name: 'Data Science', code: 'DS', icon: '📊' },
        { id: 5, name: 'Information Technology', code: 'IT', icon: '🌐' },
        { id: 6, name: 'Electronics and Communication Engineering', code: 'ECE', icon: '📡' },
        { id: 7, name: 'Electrical and Electronics Engineering', code: 'EEE', icon: '⚡' },
        { id: 8, name: 'Mechanical Engineering', code: 'MECH', icon: '⚙️' },
        { id: 9, name: 'Civil Engineering', code: 'CIVIL', icon: '🏗️' },
        { id: 10, name: 'Business and Management', code: 'MGMT', icon: '📈' },
        { id: 11, name: 'Mathematics', code: 'MATH', icon: '📐' },
        { id: 12, name: 'Physics', code: 'PHYS', icon: '🔬' },
        { id: 13, name: 'Chemistry', code: 'CHEM', icon: '🧪' }
    ],
    institutions: [
        { id: 1, name: 'RMK College of Engineering and Technology', code: 'RMKCET', location: 'Puduvoyal, Tamil Nadu' },
        { id: 2, name: 'Open Academic Consortium', code: 'OAC', location: 'Open Global Repository' }
    ],
    departments: [
        { id: 1, institution_id: 1, name: 'Computer Science and Engineering', code: 'CSE' },
        { id: 2, institution_id: 1, name: 'Computer Science & Engineering (Cyber Security)', code: 'CSE-CYBER' },
        { id: 3, institution_id: 2, name: 'Artificial Intelligence & Data Science', code: 'AI-DS' },
        { id: 4, institution_id: 2, name: 'Electronics & Hardware Systems', code: 'ECE' },
        { id: 5, institution_id: 2, name: 'Mechanical & Automation Engineering', code: 'MECH' },
        { id: 6, institution_id: 2, name: 'Applied Mathematics & Sciences', code: 'MATH-SCI' }
    ],
    courses: [
        { id: 1, department_id: 1, domain: 'Computer Science and Engineering', course_name: 'Data Structures and Algorithms', course_code: 'CS3301', semester: 3, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Trees, balanced search structures, graphs, dynamic programming, and complexity.' },
        { id: 2, department_id: 1, domain: 'Computer Science and Engineering', course_name: 'Database Management Systems', course_code: 'CS3492', semester: 4, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Relational data model, SQL, normalization (1NF-BCNF), and ACID concurrency.' },
        { id: 3, department_id: 1, domain: 'Computer Science and Engineering', course_name: 'Design and Analysis of Algorithms', course_code: 'CS3401', semester: 4, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Asymptotic analysis, divide & conquer, greedy strategy, and NP-completeness.' },
        { id: 4, department_id: 1, domain: 'Computer Science and Engineering', course_name: 'Operating Systems', course_code: 'CS3451', semester: 4, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Process scheduling, virtual memory paging, deadlock avoidance, and file systems.' },
        { id: 5, department_id: 1, domain: 'Computer Science and Engineering', course_name: 'Computer Networks', course_code: 'CS3591', semester: 5, academic_year: '3rd Year', academic_level: 'Undergraduate', description: 'OSI/TCP-IP stacks, routing protocols, flow control, and transport layer security.' },
        { id: 6, department_id: 1, domain: 'Computer Science and Engineering', course_name: 'Compiler Design', course_code: 'CS3501', semester: 5, academic_year: '3rd Year', academic_level: 'Undergraduate', description: 'Lexical analysis, syntax trees, LR parsers, and intermediate code generation.' },
        { id: 7, department_id: 3, domain: 'Artificial Intelligence and Machine Learning', course_name: 'Artificial Intelligence and Machine Learning', course_code: 'CS3691', semester: 6, academic_year: '3rd Year', academic_level: 'Undergraduate', description: 'Supervised/unsupervised models, neural networks, gradient descent, and evaluation metrics.' },
        { id: 8, department_id: 1, domain: 'Information Technology', course_name: 'Cloud Computing and DevOps', course_code: 'CS3701', semester: 7, academic_year: '4th Year', academic_level: 'Undergraduate', description: 'Containerization, microservices, AWS/GCP paradigms, and CI/CD automation pipelines.' },
        { id: 9, department_id: 2, domain: 'Cybersecurity', course_name: 'Foundations of Cyber Security', course_code: 'CB3301', semester: 3, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Security principles, authentication tokens, vulnerabilities, and defense models.' },
        { id: 10, department_id: 2, domain: 'Cybersecurity', course_name: 'Cryptography and Network Security', course_code: 'CB3401', semester: 4, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Block ciphers, public-key RSA, Diffie-Hellman, SHA-256, and digital certificates.' },
        { id: 11, department_id: 2, domain: 'Cybersecurity', course_name: 'Ethical Hacking and Penetration Testing', course_code: 'CB3501', semester: 5, academic_year: '3rd Year', academic_level: 'Undergraduate', description: 'Reconnaissance, vulnerability scanning, exploitation, and mitigation auditing.' },
        { id: 12, department_id: 2, domain: 'Cybersecurity', course_name: 'Digital Forensics and Incident Response', course_code: 'CB3601', semester: 6, academic_year: '3rd Year', academic_level: 'Undergraduate', description: 'Evidence preservation, memory analysis, log examination, and chain of custody.' },
        { id: 13, department_id: 3, domain: 'Data Science', course_name: 'Data Science & Statistical Inference', course_code: 'DS3301', semester: 3, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Exploratory data analysis, probability distributions, regression, and PCA.' },
        { id: 14, department_id: 4, domain: 'Electronics and Communication Engineering', course_name: 'Digital Signal Processing & Microcontrollers', course_code: 'EC3401', semester: 4, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'FFT algorithms, FIR/IIR filters, ARM architectures, and embedded peripherals.' },
        { id: 15, department_id: 5, domain: 'Mechanical Engineering', course_name: 'Thermodynamics and Fluid Mechanics', course_code: 'ME3301', semester: 3, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Carnot cycles, entropy principles, Navier-Stokes formulation, and heat transfer.' },
        { id: 16, department_id: 6, domain: 'Mathematics', course_name: 'Discrete Mathematics and Graph Theory', course_code: 'MA3354', semester: 3, academic_year: '2nd Year', academic_level: 'Undergraduate', description: 'Propositional logic, recurrence relations, trees, planar graphs, and combinatorics.' }
    ],
    library_books: [
        {
            id: 1,
            title: 'Computer Networks: A Systems Approach',
            author: 'Larry L. Peterson and Bruce S. Davie',
            publisher: 'Morgan Kaufmann / Open Access Edition',
            publication_year: 2021,
            domain: 'Computer Science and Engineering',
            category: 'Computer Networks',
            subject: 'Computer Networks',
            description: 'Comprehensive open-access textbook exploring the foundational architecture of the Internet, routing algorithms, transport protocols, and wireless systems.',
            resource_type: 'Open Access Textbook',
            access_url: 'https://book.systemsapproach.net/',
            license_type: 'Creative Commons CC BY 4.0',
            cover_color: '#2f8f8a'
        },
        {
            id: 2,
            title: 'Security Engineering: A Guide to Building Dependable Distributed Systems',
            author: 'Ross J. Anderson',
            publisher: 'Wiley / Author Open Edition',
            publication_year: 2020,
            domain: 'Cybersecurity',
            category: 'Cybersecurity books',
            subject: 'Cryptography and Network Security',
            description: 'The definitive cybersecurity authority covering cryptography, security protocols, access control, side-channel attacks, and resilient software defense.',
            resource_type: 'Open Access Book',
            access_url: 'https://www.cl.cam.ac.uk/~rja14/book.html',
            license_type: 'Authorized Author Public Access',
            cover_color: '#c1503f'
        },
        {
            id: 3,
            title: 'Understanding Machine Learning: From Theory to Algorithms',
            author: 'Shai Shalev-Shwartz and Shai Ben-David',
            publisher: 'Cambridge University Press / Open PDF',
            publication_year: 2014,
            domain: 'Artificial Intelligence and Machine Learning',
            category: 'AI and Machine Learning resources',
            subject: 'Artificial Intelligence and Machine Learning',
            description: 'Rigorous theoretical foundations of PAC learning, VC-dimension, Support Vector Machines, boosting, neural networks, and stochastic optimization.',
            resource_type: 'Open Educational Resource',
            access_url: 'https://www.cs.huji.ac.il/~shais/UnderstandingMachineLearning/',
            license_type: 'Authorized Open PDF for Academic Use',
            cover_color: '#34495e'
        },
        {
            id: 4,
            title: 'Operating Systems: Three Easy Pieces',
            author: 'Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau',
            publisher: 'Arpaci-Dusseau Books',
            publication_year: 2018,
            domain: 'Computer Science and Engineering',
            category: 'Operating Systems',
            subject: 'Operating Systems',
            description: 'The standard classic curriculum covering the three pillars of operating systems: Virtualization, Concurrency, and Persistence.',
            resource_type: 'Open Access Textbook',
            access_url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
            license_type: 'Free Online Educational Edition',
            cover_color: '#2980b9'
        },
        {
            id: 5,
            title: 'Database Design and Implementation: Second Edition',
            author: 'Edward Sciore',
            publisher: 'Springer / Open Educational Resource',
            publication_year: 2020,
            domain: 'Computer Science and Engineering',
            category: 'Database Management Systems',
            subject: 'Database Management Systems',
            description: 'Comprehensive engineering treatment of relational databases, query parsing, B-tree indexing, record management, and transaction logging.',
            resource_type: 'Academic Reference',
            access_url: 'https://link.springer.com/book/10.1007/978-3-030-33836-7',
            license_type: 'Open Access Chapter Resources',
            cover_color: '#8e44ad'
        },
        {
            id: 6,
            title: 'Foundations of Data Science',
            author: 'Avrim Blum, John Hopcroft, and Ravindran Kannan',
            publisher: 'Cambridge University Press',
            publication_year: 2020,
            domain: 'Data Science',
            category: 'Data Science resources',
            subject: 'Data Science & Statistical Inference',
            description: 'Covers high-dimensional space, singular value decomposition, random walks, Markov chains, graphical models, and clustering algorithms.',
            resource_type: 'Open Access Monograph',
            access_url: 'https://www.cs.cornell.edu/jeh/book.pdf',
            license_type: 'Authorized Academic PDF',
            cover_color: '#16a085'
        },
        {
            id: 7,
            title: 'Discrete Mathematics: An Open Introduction',
            author: 'Oscar Levin',
            publisher: 'School of Mathematical Sciences / Open Access',
            publication_year: 2021,
            domain: 'Mathematics',
            category: 'Mathematics',
            subject: 'Discrete Mathematics and Graph Theory',
            description: 'A free, open-source textbook for discrete mathematics covering counting, sequences, logic, proofs, and graph theory.',
            resource_type: 'Open Educational Resource',
            access_url: 'http://discrete.openmathbooks.org/dmoi3.html',
            license_type: 'Creative Commons CC BY-SA',
            cover_color: '#d35400'
        }
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
    // Direct Messaging & Conversations between accepted study partners
    conversations: [
        {
            id: 1,
            type: 'direct',
            participants: [1, 2], // Alex Johnson (1) & Sam Smith (2)
            title: null,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            updated_at: new Date(Date.now() - 3600000).toISOString()
        }
    ],
    messages: [
        {
            id: 1,
            conversation_id: 1,
            sender_id: 2,
            sender_name: 'Sam Smith',
            content: 'Hey Alex! Glad we connected. Are you studying Unit 3 of Machine Learning today?',
            message_type: 'text',
            status: 'read',
            created_at: new Date(Date.now() - 3600000 * 3).toISOString()
        },
        {
            id: 2,
            conversation_id: 1,
            sender_id: 1,
            sender_name: 'Alex Johnson',
            content: 'Hey Sam! Yes, reviewing backpropagation and gradient descent algorithms right now.',
            message_type: 'text',
            status: 'read',
            created_at: new Date(Date.now() - 3600000).toISOString()
        }
    ],
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

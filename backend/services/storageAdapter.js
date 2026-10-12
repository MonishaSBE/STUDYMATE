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
    courses: [],
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
    materials: [],
    bookmarks: [],
    ratings: [],
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
    community_questions: [],
    community_votes: {},
    ai_conversations: [],
    messages: [],
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

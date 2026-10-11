const bcrypt = require('bcryptjs');

const db = {
    users: [
        { id: 1, email: 'test@test.com', password_hash: bcrypt.hashSync('password', 10), role: 'admin' },
        { id: 2, email: 'student2@test.com', password_hash: bcrypt.hashSync('password', 10), role: 'student' },
        { id: 3, email: 'student3@test.com', password_hash: bcrypt.hashSync('password', 10), role: 'student' }
    ],
    profiles: [
        { id: 1, user_id: 1, name: 'Alex Johnson', department: 'Computer Science', academic_year: '3rd Year', bio: 'Love coding and AI.', available_time: 'Evenings', subjects: ['Data Structures', 'Machine Learning'] },
        { id: 2, user_id: 2, name: 'Sam Smith', department: 'Computer Science', academic_year: '3rd Year', bio: 'Looking for ML study buddies.', available_time: 'Evenings', subjects: ['Machine Learning', 'Algorithms'] },
        { id: 3, user_id: 3, name: 'Taylor Doe', department: 'Computer Science', academic_year: '2nd Year', bio: 'Need help with math.', available_time: 'Weekends', subjects: ['Data Structures', 'Calculus'] }
    ],
    groups: [
        { ROWID: 1, group_name: 'ML Enthusiasts', description: 'Studying for the upcoming machine learning midterms.', max_members: 5, created_by: 2, members: [2, 3] },
        { ROWID: 2, group_name: 'Late Night Coders', description: 'Working on projects after midnight.', max_members: 4, created_by: 3, members: [3] }
    ],
    requests: [
        { ROWID: 1, sender_id: 2, receiver_id: 1, status: 'pending', sender_name: 'Sam Smith', receiver_name: 'Alex Johnson' }
    ],
    notes: [
        { ROWID: 1, group_id: 1, uploaded_by: 2, title: 'Neural Networks Cheat Sheet', file_url: '#', uploader_name: 'Sam Smith' },
        { ROWID: 2, group_id: 1, uploaded_by: 3, title: 'Exam Prep Guide', file_url: '#', uploader_name: 'Taylor Doe' }
    ],
    goals: [
        { ROWID: 1, student_id: 1, goal_text: 'Complete project documentation', target_date: '2026-10-15', is_completed: false },
        { ROWID: 2, student_id: 1, goal_text: 'Review data structures', target_date: '2026-10-10', is_completed: true }
    ],
    nextId: 10
};

module.exports = db;

const mongoose = require('mongoose');

// User Schema
const UserSchema = new mongoose.Schema({
    userId: { type: Number, index: true },
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, default: null },
    google_id: { type: String, default: null },
    role: { type: String, default: 'student' },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Profile Schema
const ProfileSchema = new mongoose.Schema({
    profileId: { type: Number, index: true },
    user_id: { type: Number, index: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    department: { type: String, default: '' },
    academic_year: { type: String, default: '' },
    bio: { type: String, default: '' },
    available_time: { type: String, default: '' },
    subjects: [{ type: String }],
    active_days: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Study Group Schema
const GroupSchema = new mongoose.Schema({
    ROWID: { type: Number, index: true },
    group_name: { type: String, required: true },
    description: { type: String, default: '' },
    max_members: { type: Number, default: 6 },
    created_by: { type: Number },
    members: [{ type: Number }],
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Chat / Partner Request Schema
const RequestSchema = new mongoose.Schema({
    ROWID: { type: Number, index: true },
    sender_id: { type: Number, required: true },
    receiver_id: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    sender_name: { type: String, default: '' },
    receiver_name: { type: String, default: '' },
    intro_message: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Shared Notes Schema
const NoteSchema = new mongoose.Schema({
    ROWID: { type: Number, index: true },
    user_id: { type: Number },
    group_id: { type: Number, default: null },
    uploaded_by: { type: Number },
    uploader_name: { type: String, default: '' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subject: { type: String, default: 'General' },
    domain: { type: String, default: 'Computer Science and Engineering' },
    resource_type: { type: String, default: 'lecture_notes' },
    academic_year: { type: String, default: '2nd Year' },
    file_url: { type: String, default: '#' },
    file_path: { type: String, default: null },
    file_name: { type: String, default: '' },
    file_size: { type: Number, default: 0 },
    visibility: { type: String, default: 'public' },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Goals Schema
const GoalSchema = new mongoose.Schema({
    ROWID: { type: Number, index: true },
    student_id: { type: Number, required: true },
    goal_text: { type: String, required: true },
    target_date: { type: String, default: '' },
    is_completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Material Schema
const MaterialSchema = new mongoose.Schema({
    id: { type: Number, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    course_id: { type: Number, default: 1 },
    institution_id: { type: Number, default: 1 },
    subject_name: { type: String, default: '' },
    domain: { type: String, default: 'Computer Science and Engineering' },
    resource_type: { type: String, default: 'lecture_notes' },
    examination_type: { type: String, default: 'University Semester Exam' },
    file_path: { type: String, default: null },
    file_name: { type: String, default: '' },
    file_size: { type: Number, default: 0 },
    mime_type: { type: String, default: 'application/pdf' },
    uploaded_by: { type: Number, default: 1 },
    uploader_name: { type: String, default: '' },
    views_count: { type: Number, default: 0 },
    downloads_count: { type: Number, default: 0 },
    is_moderated: { type: Boolean, default: true },
    tags: [{ type: String }],
    }, { strict: false });
// Conversation Schema// Conversation Schema
const ConversationSchema = new mongoose.Schema({
    id: { type: Number, index: true },
    type: { type: String, default: 'direct' },
    participants: [{ type: Number }],
    title: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { strict: false });

// Message Schema
const MessageSchema = new mongoose.Schema({
    id: { type: Number, index: true },
    conversation_id: { type: Number, index: true },
    sender_id: { type: Number },
    sender_name: { type: String, default: '' },
    content: { type: String, default: '' },
    message_type: { type: String, default: 'text' },
    status: { type: String, default: 'sent' },
    created_at: { type: Date, default: Date.now }
}, { strict: false });

const User = mongoose.model('User', UserSchema);
const Profile = mongoose.model('Profile', ProfileSchema);
const Group = mongoose.model('Group', GroupSchema);
const Request = mongoose.model('Request', RequestSchema);
const Note = mongoose.model('Note', NoteSchema);
const Goal = mongoose.model('Goal', GoalSchema);
const Material = mongoose.model('Material', MaterialSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);

module.exports = {
    User,
    Profile,
    Group,
    Request,
    Note,
    Goal,
    Material,
    Conversation,
    Message
};

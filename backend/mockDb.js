const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { isMongoConnected } = require('./config/mongodb');
const { User, Profile, Group, Request, Note, Goal, Material } = require('./models');

const DB_FILE = path.join(__dirname, '../database/local_db.json');

// Initial empty dataset — all data is added dynamically by real registered users
const initialData = {
    users: [],
    profiles: [],
    groups: [],
    requests: [],
    notes: [],
    goals: [],
    streaks: {},
    nextId: 1
};

// Ensure database directory exists
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Load data from disk or fallback
let store = { ...initialData };
try {
    if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        store = JSON.parse(fileContent);
        // Ensure arrays exist
        ['users', 'profiles', 'groups', 'requests', 'notes', 'goals'].forEach(key => {
            if (!Array.isArray(store[key])) store[key] = initialData[key] || [];
        });
        if (!store.nextId) store.nextId = 1;
        if (!store.streaks) store.streaks = {};
    } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    }
} catch (e) {
    console.error('[DB] Error loading local_db.json, using fallback:', e.message);
}

// Function to persist store to disk
function persist() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
        console.error('[DB] Error saving to disk:', e.message);
    }
}

// Load data from MongoDB Atlas if available
async function loadFromMongo() {
    if (!isMongoConnected()) return;
    try {
        const [users, profiles, groups, requests, notes, goals, materials] = await Promise.all([
            User.find({}).lean(),
            Profile.find({}).lean(),
            Group.find({}).lean(),
            Request.find({}).lean(),
            Note.find({}).lean(),
            Goal.find({}).lean(),
            Material.find({}).lean()
        ]);

        if (users && users.length > 0) {
            users.forEach(u => {
                const uid = u.userId || u.id;
                const idx = store.users.findIndex(x => x.id === uid || x.email === u.email);
                const obj = {
                    id: uid,
                    name: u.name || '',
                    email: u.email,
                    password_hash: u.password_hash || null,
                    google_id: u.google_id || null,
                    role: u.role || 'student'
                };
                if (idx >= 0) store.users[idx] = { ...store.users[idx], ...obj };
                else store.users.push(obj);
            });
        }

        if (profiles && profiles.length > 0) {
            profiles.forEach(p => {
                const pid = p.profileId || p.id;
                const idx = store.profiles.findIndex(x => x.id === pid || x.user_id === p.user_id);
                const obj = {
                    id: pid,
                    user_id: p.user_id,
                    name: p.name,
                    email: p.email || '',
                    department: p.department || '',
                    academic_year: p.academic_year || '',
                    bio: p.bio || '',
                    available_time: p.available_time || '',
                    subjects: p.subjects || [],
                    active_days: p.active_days || []
                };
                if (idx >= 0) store.profiles[idx] = { ...store.profiles[idx], ...obj };
                else store.profiles.push(obj);
            });
        }

        if (groups && groups.length > 0) {
            groups.forEach(g => {
                const idx = store.groups.findIndex(x => x.ROWID === g.ROWID);
                const obj = {
                    ROWID: g.ROWID,
                    group_name: g.group_name,
                    description: g.description || '',
                    max_members: g.max_members || 6,
                    created_by: g.created_by,
                    members: g.members || []
                };
                if (idx >= 0) store.groups[idx] = { ...store.groups[idx], ...obj };
                else store.groups.push(obj);
            });
        }

        if (requests && requests.length > 0) {
            requests.forEach(r => {
                const idx = store.requests.findIndex(x => x.ROWID === r.ROWID);
                const obj = {
                    ROWID: r.ROWID,
                    sender_id: r.sender_id,
                    receiver_id: r.receiver_id,
                    status: r.status || 'pending',
                    sender_name: r.sender_name || '',
                    receiver_name: r.receiver_name || '',
                    intro_message: r.intro_message || '',
                    created_at: r.createdAt || r.created_at || new Date().toISOString()
                };
                if (idx >= 0) store.requests[idx] = { ...store.requests[idx], ...obj };
                else store.requests.push(obj);
            });
        }

        if (notes && notes.length > 0) {
            notes.forEach(n => {
                const idx = store.notes.findIndex(x => x.ROWID === n.ROWID);
                const obj = {
                    ROWID: n.ROWID,
                    user_id: n.user_id,
                    group_id: n.group_id || null,
                    uploaded_by: n.uploaded_by,
                    uploader_name: n.uploader_name || 'Student',
                    title: n.title,
                    description: n.description || '',
                    subject: n.subject || 'General',
                    domain: n.domain || 'Computer Science and Engineering',
                    resource_type: n.resource_type || 'lecture_notes',
                    academic_year: n.academic_year || '2nd Year',
                    file_url: n.file_url || '#',
                    file_path: n.file_path || null,
                    file_name: n.file_name || null,
                    file_size: n.file_size || 0,
                    visibility: n.visibility || 'public',
                    created_at: n.createdAt || n.created_at || new Date().toISOString()
                };
                if (idx >= 0) store.notes[idx] = { ...store.notes[idx], ...obj };
                else store.notes.push(obj);
            });
        }

        if (goals && goals.length > 0) {
            goals.forEach(gl => {
                const idx = store.goals.findIndex(x => x.ROWID === gl.ROWID);
                const obj = {
                    ROWID: gl.ROWID,
                    student_id: gl.student_id,
                    goal_text: gl.goal_text,
                    target_date: gl.target_date || '',
                    is_completed: gl.is_completed || false
                };
                if (idx >= 0) store.goals[idx] = { ...store.goals[idx], ...obj };
                else store.goals.push(obj);
            });
        }

        // Recompute nextId
        const ids = [
            ...store.users.map(u => u.id || 0),
            ...store.profiles.map(p => p.id || 0),
            ...store.groups.map(g => g.ROWID || 0),
            ...store.requests.map(r => r.ROWID || 0),
            ...store.notes.map(n => n.ROWID || 0),
            ...store.goals.map(gl => gl.ROWID || 0),
            store.nextId || 1
        ];
        store.nextId = Math.max(...ids, 0) + 1;

        persist();
        console.log(`✅ [MongoDB] Synchronized data from MongoDB Atlas into active store (${store.users.length} users, ${store.profiles.length} profiles, ${store.notes.length} notes, ${store.requests.length} requests, ${store.groups.length} groups, ${store.goals.length} goals).`);
    } catch (err) {
        console.error('❌ [MongoDB] Error loading data from Atlas:', err.message);
    }
}

// Sync local in-memory store to MongoDB Atlas if connected
async function syncMongo() {
    if (!isMongoConnected()) return;
    try {
        // Sync Users
        for (const u of store.users) {
            await User.findOneAndUpdate(
                { email: u.email },
                { userId: u.id, name: u.name || '', email: u.email, password_hash: u.password_hash || null, google_id: u.google_id || null, role: u.role || 'student' },
                { upsert: true, new: true }
            );
        }

        // Sync Profiles
        for (const p of store.profiles) {
            await Profile.findOneAndUpdate(
                { user_id: p.user_id },
                { profileId: p.id, user_id: p.user_id, name: p.name, email: p.email || '', department: p.department, academic_year: p.academic_year, bio: p.bio, available_time: p.available_time, subjects: p.subjects, active_days: p.active_days },
                { upsert: true, new: true }
            );
        }

        // Sync Groups
        for (const g of store.groups) {
            await Group.findOneAndUpdate(
                { ROWID: g.ROWID },
                { ROWID: g.ROWID, group_name: g.group_name, description: g.description, max_members: g.max_members, created_by: g.created_by, members: g.members },
                { upsert: true, new: true }
            );
        }

        // Sync Requests
        for (const r of store.requests) {
            await Request.findOneAndUpdate(
                { ROWID: r.ROWID },
                { ROWID: r.ROWID, sender_id: r.sender_id, receiver_id: r.receiver_id, status: r.status, sender_name: r.sender_name, receiver_name: r.receiver_name, intro_message: r.intro_message || '' },
                { upsert: true, new: true }
            );
        }

        // Sync Goals
        for (const gl of store.goals) {
            await Goal.findOneAndUpdate(
                { ROWID: gl.ROWID },
                { ROWID: gl.ROWID, student_id: gl.student_id, goal_text: gl.goal_text, target_date: gl.target_date, is_completed: gl.is_completed },
                { upsert: true, new: true }
            );
        }

        // Sync Notes
        for (const n of store.notes) {
            await Note.findOneAndUpdate(
                { ROWID: n.ROWID },
                n,
                { upsert: true, new: true }
            );
        }
    } catch (err) {
        console.error('[MongoDB] Periodic sync error:', err.message);
    }
}

// Background sync attempt every 30s
setInterval(() => {
    if (isMongoConnected()) {
        syncMongo().catch(() => {});
    }
}, 30000);

const db = {
    get users() { return store.users; },
    get profiles() { return store.profiles; },
    get groups() { return store.groups; },
    get requests() { return store.requests; },
    get notes() { return store.notes; },
    get goals() { return store.goals; },
    get streaks() { return store.streaks; },
    get nextId() { return store.nextId; },
    set nextId(val) { store.nextId = val; persist(); },

    persist,
    syncMongo,
    loadFromMongo,

    // Helper to update streak for a student
    saveStreak(studentId, streakData) {
        if (!store.streaks) store.streaks = {};
        store.streaks[String(studentId)] = streakData;
        persist();
    },

    // Helper to get streak for a student
    getStreak(studentId) {
        if (!store.streaks) store.streaks = {};
        return store.streaks[String(studentId)] || { current: 0, longest: 0, lastCompletedDate: null };
    },

    // Helper to add/update user
    async saveUser(user) {
        const idx = store.users.findIndex(u => u.id === user.id || u.email === user.email);
        if (idx >= 0) store.users[idx] = { ...store.users[idx], ...user };
        else store.users.push(user);
        persist();

        if (isMongoConnected()) {
            try {
                await User.findOneAndUpdate(
                    { email: user.email },
                    { userId: user.id, name: user.name || '', email: user.email, password_hash: user.password_hash, role: user.role },
                    { upsert: true, new: true }
                );
            } catch (e) {
                console.error('[MongoDB] Error saving User to MongoDB:', e.message);
            }
        }
    },

    // Helper to add/update profile
    async saveProfile(profile) {
        const idx = store.profiles.findIndex(p => p.id === profile.id || p.user_id === profile.user_id);
        if (idx >= 0) store.profiles[idx] = { ...store.profiles[idx], ...profile };
        else store.profiles.push(profile);
        persist();

        if (isMongoConnected()) {
            try {
                await Profile.findOneAndUpdate(
                    { user_id: profile.user_id },
                    { profileId: profile.id, user_id: profile.user_id, name: profile.name, department: profile.department, academic_year: profile.academic_year, bio: profile.bio, available_time: profile.available_time, subjects: profile.subjects },
                    { upsert: true, new: true }
                );
            } catch (e) {
                console.error('[MongoDB] Error saving Profile to MongoDB:', e.message);
            }
        }
    },

    // Helper to add/update group
    async saveGroup(group) {
        const idx = store.groups.findIndex(g => g.ROWID === group.ROWID);
        if (idx >= 0) store.groups[idx] = { ...store.groups[idx], ...group };
        else store.groups.push(group);
        persist();

        if (isMongoConnected()) {
            try {
                await Group.findOneAndUpdate(
                    { ROWID: group.ROWID },
                    group,
                    { upsert: true, new: true }
                );
            } catch (e) {
                console.error('[MongoDB] Error saving Group to MongoDB:', e.message);
            }
        }
    },

    // Helper to add/update request
    async saveRequest(req) {
        const idx = store.requests.findIndex(r => r.ROWID === req.ROWID);
        if (idx >= 0) store.requests[idx] = { ...store.requests[idx], ...req };
        else store.requests.push(req);
        persist();

        if (isMongoConnected()) {
            try {
                await Request.findOneAndUpdate(
                    { ROWID: req.ROWID },
                    req,
                    { upsert: true, new: true }
                );
            } catch (e) {
                console.error('[MongoDB] Error saving Request to MongoDB:', e.message);
            }
        }
    },

    // Helper to add/update goal
    async saveGoal(goal) {
        const idx = store.goals.findIndex(g => g.ROWID === goal.ROWID);
        if (idx >= 0) store.goals[idx] = { ...store.goals[idx], ...goal };
        else store.goals.push(goal);
        persist();

        if (isMongoConnected()) {
            try {
                await Goal.findOneAndUpdate(
                    { ROWID: goal.ROWID },
                    goal,
                    { upsert: true, new: true }
                );
            } catch (e) {
                console.error('[MongoDB] Error saving Goal to MongoDB:', e.message);
            }
        }
    },

    // Helper to remove goal
    async deleteGoal(rowId) {
        const idx = store.goals.findIndex(g => g.ROWID === rowId);
        if (idx >= 0) {
            store.goals.splice(idx, 1);
            persist();
        }
        if (isMongoConnected()) {
            try {
                await Goal.deleteOne({ ROWID: rowId });
            } catch (e) {
                console.error('[MongoDB] Error deleting Goal from MongoDB:', e.message);
            }
        }
    },

    // Helper to add note
    async saveNote(note) {
        const idx = store.notes.findIndex(n => n.ROWID === note.ROWID);
        if (idx >= 0) store.notes[idx] = { ...store.notes[idx], ...note };
        else store.notes.push(note);
        persist();

        if (isMongoConnected()) {
            try {
                await Note.findOneAndUpdate(
                    { ROWID: note.ROWID },
                    note,
                    { upsert: true, new: true }
                );
            } catch (e) {
                console.error('[MongoDB] Error saving Note to MongoDB:', e.message);
            }
        }
    }
};

module.exports = db;

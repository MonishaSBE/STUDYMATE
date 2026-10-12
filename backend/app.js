const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const ConnectMongo = require('connect-mongo');
const MongoStore = ConnectMongo.default || ConnectMongo.MongoStore;
const { connectDB } = require('./config/mongodb');

const app = express();

// Enable trust proxy for cloud deployment (e.g., Render, Railway, Heroku) behind HTTPS reverse proxies
app.set('trust proxy', 1);

// Initialize MongoDB connection on launch
connectDB();

app.use(cors());
app.use(express.json());

// Persistent MongoDB session store — sessions survive server restarts and inactivity
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://swethamoni2011_db_user:studymate@cluster0.6pzpwqd.mongodb.net/studymate?appName=Cluster0';
const sessionStore = MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',
    ttl: 30 * 24 * 60 * 60, // 30 days
    autoRemove: 'native'
});

app.use(session({
    key: 'studymate_session',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'super_secret_studymate_key',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Renews 30-day cookie on every user visit
    proxy: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/match', require('./routes/matchingRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/notes', require('./routes/notesRoutes'));
app.use('/api/goals', require('./routes/goalRoutes'));

// Academic Platform Enhancement Routes
app.use('/api/catalogue', require('./routes/catalogueRoutes'));
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/quizzes', require('./routes/quizRoutes'));
app.use('/api/flashcards', require('./routes/flashcardRoutes'));
app.use('/api/concept-maps', require('./routes/conceptMapRoutes'));
app.use('/api/community', require('./routes/communityRoutes'));
app.use('/api/hub', require('./routes/dashboardHubRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// Serve uploaded files securely
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// 404 Handler: When user requests a page that is not found
app.use((req, res, next) => {
    // Return JSON error for unmatched API endpoints
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            status: 'failure',
            message: `Requested API endpoint not found: ${req.method} ${req.originalUrl}`
        });
    }

    // Return custom designed 404.html page for web requests
    const notFoundFile = path.join(__dirname, '../frontend/404.html');
    if (fs.existsSync(notFoundFile)) {
        return res.status(404).sendFile(notFoundFile);
    }
    res.status(404).send('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>404 — Page Not Found</h1><p>The requested page does not exist.</p><a href="/">Return to StudyMate</a></body></html>');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'failure', message: 'Internal Server Error' });
});

module.exports = app;

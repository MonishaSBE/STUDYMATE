const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(session({
    key: 'studymate_session',
    secret: process.env.SESSION_SECRET || 'super_secret_studymate_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
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

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));



// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'failure', message: 'Internal Server Error' });
});

module.exports = app;

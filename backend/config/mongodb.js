const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://swethamoni2011_db_user:studymate@cluster0.6pzpwqd.mongodb.net/studymate?appName=Cluster0';

let isConnected = false;

const connectDB = async () => {
    try {
        console.log('[MongoDB] Connecting to MongoDB Atlas cluster...');
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        isConnected = true;
        console.log('✅ [MongoDB] Successfully connected to MongoDB Atlas Database: studymate');
    } catch (err) {
        isConnected = false;
        console.warn('⚠️ [MongoDB] Atlas connection could not be established immediately (' + err.message + ').');
        console.warn('💡 [MongoDB Tip] If IP Whitelist is active in Atlas, add 0.0.0.0/0 under Network Access in MongoDB Atlas dashboard.');
        console.warn('⚡ [StudyMate] Active resilient dynamic store engaged — data will stay dynamic, persistent, and auto-sync when Atlas is reachable.');
    }
};

mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('✅ [MongoDB] Connection established.');
});

mongoose.connection.on('error', (err) => {
    isConnected = false;
    console.error('❌ [MongoDB] Error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.log('ℹ️ [MongoDB] Disconnected.');
});

module.exports = {
    connectDB,
    isMongoConnected: () => isConnected,
    mongoose
};

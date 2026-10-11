const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configurable constants
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB limit

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'image/png',
    'image/jpeg'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.pptx', '.png', '.jpg', '.jpeg'];

function sanitizeFilename(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, ext)
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .substring(0, 50);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    return `${base}-${uniqueSuffix}${ext}`;
}

function isValidFileType(originalName, mimeType) {
    const ext = path.extname(originalName).toLowerCase();
    const validExt = ALLOWED_EXTENSIONS.includes(ext);
    const validMime = ALLOWED_MIME_TYPES.includes(mimeType) || mimeType === 'application/octet-stream';
    return validExt && validMime;
}

module.exports = {
    UPLOADS_DIR,
    MAX_FILE_SIZE_BYTES,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS,
    sanitizeFilename,
    isValidFileType
};

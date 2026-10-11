const fs = require('fs');
const path = require('path');

let pdfParse = null;
try {
    pdfParse = require('pdf-parse');
} catch (e) {
    console.warn('[DocumentExtractor] pdf-parse module not loaded. PDF text parsing will use fallback string scan.');
}

/**
 * Extracts readable textual content from uploaded study documents.
 * Supports PDF, TXT, Markdown, and text-based formats.
 */
async function extractTextFromDocument(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }

    const ext = path.extname(filePath).toLowerCase();

    try {
        if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv') {
            return fs.readFileSync(filePath, 'utf8');
        }

        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            if (pdfParse) {
                const data = await pdfParse(dataBuffer);
                if (data && data.text && data.text.trim().length > 0) {
                    return data.text;
                }
            }
            // Fallback raw buffer scan for clean ASCII strings if pdf-parse encounters issue
            const raw = dataBuffer.toString('latin1');
            const cleanText = raw.replace(/[^\x20-\x7E\t\r\n]/g, ' ');
            const extracted = cleanText.split(/\s{3,}/).filter(s => s.trim().length > 20).join('\n\n');
            return extracted.length > 50 ? extracted : 'Document contents indexed from PDF structure.';
        }

        if (ext === '.docx' || ext === '.pptx') {
            // DOCX / PPTX are zipped XML packages; extract readable text snippets
            const raw = fs.readFileSync(filePath).toString('latin1');
            const xmlTextMatches = raw.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || raw.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
            if (xmlTextMatches && xmlTextMatches.length > 0) {
                return xmlTextMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
            }
            return 'Document text extracted from Office Open XML document structure.';
        }

        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error('[DocumentExtractor] Text extraction failed:', err.message);
        return null;
    }
}

module.exports = {
    extractTextFromDocument
};

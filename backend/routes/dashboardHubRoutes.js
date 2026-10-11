const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');

// Get Aggregated Personal Learning Metrics & History
router.get('/metrics', auth, (req, res) => {
    const userId = req.session.userId;

    // 1. User's uploaded materials
    const uploadedMaterials = fallbackData.materials.filter(m => m.uploaded_by === userId);

    // 2. User's bookmarked materials
    const bookmarkedMaterialIds = fallbackData.bookmarks
        .filter(b => b.user_id === userId)
        .map(b => b.material_id);
    const bookmarkedMaterials = fallbackData.materials.filter(m => bookmarkedMaterialIds.includes(m.id));

    // 3. User's quiz history & stats
    const userAttempts = fallbackData.quiz_attempts.filter(a => a.user_id === userId);
    const totalScore = userAttempts.reduce((acc, a) => acc + (a.score || 0), 0);
    const totalPossible = userAttempts.reduce((acc, a) => acc + (a.total_questions || 0), 0);
    const averageQuizAccuracy = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

    // 4. User's flashcard decks
    const flashcardDecks = fallbackData.flashcard_decks.filter(d => d.user_id === userId);
    let totalCardsMastered = 0;
    Object.keys(fallbackData.flashcard_progress).forEach(k => {
        if (k.startsWith(`${userId}_`) && fallbackData.flashcard_progress[k] === 'mastered') {
            totalCardsMastered++;
        }
    });

    // 5. User's concept maps
    const conceptMaps = fallbackData.concept_maps.filter(m => m.user_id === userId);

    // 6. User's community discussions
    const myQuestions = fallbackData.community_questions.filter(q => q.user_id === userId);
    let myAnswersCount = 0;
    fallbackData.community_questions.forEach(q => {
        myAnswersCount += (q.answers || []).filter(a => a.user_id === userId).length;
    });

    res.json({
        status: 'success',
        data: {
            stats: {
                materials_uploaded: uploadedMaterials.length,
                bookmarks_count: bookmarkedMaterials.length,
                quizzes_completed: userAttempts.length,
                quiz_accuracy_pct: averageQuizAccuracy,
                flashcard_decks_count: flashcardDecks.length,
                cards_mastered: totalCardsMastered,
                concept_maps_count: conceptMaps.length,
                community_questions_count: myQuestions.length,
                community_answers_count: myAnswersCount
            },
            uploaded_materials: uploadedMaterials,
            saved_materials: bookmarkedMaterials,
            recent_quiz_attempts: userAttempts.slice(0, 5),
            flashcard_decks: flashcardDecks,
            concept_maps: conceptMaps,
            community_activity: myQuestions
        }
    });
});

module.exports = router;

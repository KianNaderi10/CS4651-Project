const express = require('express');
const router = express.Router();
const { scorePoll } = require('./scoring');
const { getLeaderboard } = require('./leaderboard');

// POST /polls/:id/result
// Called by admin to score a poll after entering the correct answer
router.post('/polls/:id/result', async (req, res) => {
    const pollId = req.params.id;
    const { correctAnswer } = req.body;

    if (!correctAnswer) {
        return res.status(400).json({ error: 'correctAnswer is required' });
    }

    try {
        const result = await scorePoll(pollId, correctAnswer);
        res.status(200).json({
            message: 'Poll scored successfully',
            ...result
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /leaderboard
// Returns all players ranked by total points
router.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = await getLeaderboard();
        res.status(200).json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
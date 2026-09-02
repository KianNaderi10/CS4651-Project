const db = require('./db');

async function scorePoll(pollId, correctAnswer) {
    // Step 1: check the poll exists and hasn't been scored yet
    const [polls] = await db.query(
        'SELECT * FROM polls WHERE poll_id = ? AND status = ?',
        [pollId, 'closed']
    );

    if (polls.length === 0) {
        throw new Error('Poll not found or not eligible for scoring');
    }

    // Step 2: get all predictions for this poll
    const [predictions] = await db.query(
        'SELECT * FROM predictions WHERE poll_id = ?',
        [pollId]
    );

    // Step 3: loop through predictions and award points
    let playersScored = 0;

    for (const prediction of predictions) {
        const isCorrect = prediction.answer === correctAnswer;
        const pointsEarned = isCorrect ? 10 : 0;

        await db.query(
            `INSERT IGNORE INTO poll_score_log (player_id, poll_id, points_earned)
             VALUES (?, ?, ?)`,
            [prediction.player_id, pollId, pointsEarned]
        );

        if (isCorrect) {
            await db.query(
                `INSERT INTO scores (player_id, total_points)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE total_points = total_points + ?`,
                [prediction.player_id, pointsEarned, pointsEarned]
            );
            playersScored++;
        }
    }

    // Step 4: mark the poll as scored
    await db.query(
        'UPDATE polls SET status = ? WHERE poll_id = ?',
        ['scored', pollId]
    );

    return {
        pollId,
        totalPredictions: predictions.length,
        playersScored
    };
}

module.exports = { scorePoll };
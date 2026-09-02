const db = require('./db');

async function getLeaderboard() {
    const [rows] = await db.query(
        `SELECT 
            p.player_id,
            p.username,
            COALESCE(s.total_points, 0) AS total_points,
            RANK() OVER (ORDER BY COALESCE(s.total_points, 0) DESC) AS player_rank
         FROM players p
         LEFT JOIN scores s ON p.player_id = s.player_id
         ORDER BY player_rank`
    );

    return rows;
}

module.exports = { getLeaderboard };
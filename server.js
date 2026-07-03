const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'database-1.cjvem5vqybdc.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Yervand123',
  database: 'predictionpoll'
});

db.connect((err) => {
  if (err) {
    console.log('Connection failed:', err);
    return;
  }
  console.log('Connected to database');
});

// ---------- Player routes (Ero) ----------

app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  const query = 'INSERT INTO players (username, email, password) VALUES (?, ?, ?)';
  db.query(query, [name, email, password], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Player registered', id: result.insertId });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM players WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ message: 'Login success', playerId: results[0].player_id, name: results[0].username });
  });
});

app.get('/polls', (req, res) => {
  const query = "SELECT * FROM polls WHERE status = 'open'";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/predict', (req, res) => {
  const { player_id, poll_id, answer } = req.body;
  const query = 'INSERT INTO predictions (player_id, poll_id, answer) VALUES (?, ?, ?)';
  db.query(query, [player_id, poll_id, answer], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Prediction submitted' });
  });
});

// ---------- Admin routes (Kian) ----------

app.get('/api/polls', (req, res) => {
  const query = 'SELECT poll_id, question, option_1, option_2, deadline, correct_answer, status FROM polls ORDER BY poll_id DESC';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: 'Could not load polls.' });
    res.json(results);
  });
});

app.post('/api/polls', (req, res) => {
  const { question, option1, option2, deadline } = req.body;
  if (!question || !option1 || !option2 || !deadline) {
    return res.status(400).json({ message: 'Question, both options, and deadline are required.' });
  }
  const insertQuery = "INSERT INTO polls (question, option_1, option_2, deadline, status) VALUES (?, ?, ?, ?, 'open')";
  db.query(insertQuery, [question, option1, option2, deadline], (err, result) => {
    if (err) return res.status(500).json({ message: 'Could not create poll.' });
    db.query('SELECT * FROM polls WHERE poll_id = ?', [result.insertId], (err2, rows) => {
      if (err2) return res.status(500).json({ message: 'Poll created but could not fetch it back.' });
      res.status(201).json(rows[0]);
    });
  });
});

app.patch('/api/polls/:id/close', (req, res) => {
  const query = "UPDATE polls SET status = 'closed' WHERE poll_id = ? AND status = 'open'";
  db.query(query, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Could not close poll.' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Open poll not found.' });
    res.json({ message: 'Poll closed.' });
  });
});

// ---------- Scoring routes (Mr. Sir) ----------
// This POST replaces the old admin PATCH /result route.
// It sets the correct answer, scores every prediction, and marks the poll scored, all in one step.

app.patch('/api/polls/:id/result', (req, res) => {
  const pollId = req.params.id;
  const { correctAnswer } = req.body;
  if (!correctAnswer) return res.status(400).json({ error: 'correctAnswer is required' });

  db.query('SELECT * FROM polls WHERE poll_id = ? AND status = ?', [pollId, 'closed'], (err, polls) => {
    if (err) return res.status(500).json({ error: err.message });
    if (polls.length === 0) return res.status(400).json({ error: 'Poll not found or not eligible for scoring' });

    db.query('SELECT * FROM predictions WHERE poll_id = ?', [pollId], (err2, predictions) => {
      if (err2) return res.status(500).json({ error: err2.message });

      let playersScored = 0;
      let remaining = predictions.length;

      if (remaining === 0) {
        return finishScoring();
      }

      predictions.forEach((prediction) => {
        const isCorrect = prediction.answer === correctAnswer;
        const pointsEarned = isCorrect ? 10 : 0;

        db.query(
          'INSERT IGNORE INTO poll_score_log (player_id, poll_id, points_earned) VALUES (?, ?, ?)',
          [prediction.player_id, pollId, pointsEarned],
          () => {
            if (isCorrect) {
              db.query(
                'INSERT INTO scores (player_id, total_points) VALUES (?, ?) ON DUPLICATE KEY UPDATE total_points = total_points + ?',
                [prediction.player_id, pointsEarned, pointsEarned],
                () => {
                  playersScored++;
                  remaining--;
                  if (remaining === 0) finishScoring();
                }
              );
            } else {
              remaining--;
              if (remaining === 0) finishScoring();
            }
          }
        );
      });

      function finishScoring() {
        db.query('UPDATE polls SET correct_answer = ?, status = ? WHERE poll_id = ?', [correctAnswer, 'scored', pollId], (err3) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ message: 'Poll scored successfully', pollId, totalPredictions: predictions.length, playersScored });
        });
      }
    });
  });
});

app.get('/api/leaderboard', (req, res) => {
  const query = `
    SELECT p.player_id, p.username, COALESCE(s.total_points, 0) AS total_points,
      RANK() OVER (ORDER BY COALESCE(s.total_points, 0) DESC) AS player_rank
    FROM players p
    LEFT JOIN scores s ON p.player_id = s.player_id
    ORDER BY player_rank
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

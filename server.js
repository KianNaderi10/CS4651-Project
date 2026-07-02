const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'database-1.cjvem5vqybdc.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'CS4651123',
  database: 'predictionpoll'
});

db.connect((err) => {
  if (err) {
    console.log('Connection failed:', err);
    return;
  }
  console.log('Connected to database');
});

app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  const query = 'INSERT INTO players (name, email, password) VALUES (?, ?, ?)';
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
    res.json({ message: 'Login success', playerId: results[0].id, name: results[0].name });
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
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
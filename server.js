require("dotenv").config();

const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

app.use(express.json());

app.use(express.static(path.join(__dirname, "admin")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "admin.html"));
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ message: "Server and database connection work." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: "Server is running, but cannot connect to the database."
    });
  }
});

// Get every poll for the admin dashboard
app.get("/api/polls", async (req, res) => {
  try {
    const [polls] = await pool.query(`
      SELECT
        poll_id,
        question,
        option_1,
        option_2,
        deadline,
        correct_answer,
        status
      FROM polls
      ORDER BY poll_id DESC
    `);

    res.json(polls);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Could not load polls." });
  }
});

// Create a new poll
app.post("/api/polls", async (req, res) => {
  const { question, option1, option2, deadline } = req.body;

  if (!question || !option1 || !option2 || !deadline) {
    return res.status(400).json({
      message: "Question, both options, and deadline are required."
    });
  }

  try {
    const [result] = await pool.query(
      `
        INSERT INTO polls (question, option_1, option_2, deadline, status)
        VALUES (?, ?, ?, ?, 'open')
      `,
      [question, option1, option2, deadline]
    );

    const [newPoll] = await pool.query(
      "SELECT * FROM polls WHERE poll_id = ?",
      [result.insertId]
    );

    res.status(201).json(newPoll[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Could not create poll." });
  }
});

// Close one poll
app.patch("/api/polls/:id/close", async (req, res) => {
  try {
    const [result] = await pool.query(
      `
        UPDATE polls
        SET status = 'closed'
        WHERE poll_id = ? AND status = 'open'
      `,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Open poll not found."
      });
    }

    res.json({ message: "Poll closed." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Could not close poll." });
  }
});

// Save the official result and settle the poll
app.patch("/api/polls/:id/result", async (req, res) => {
  const { correctAnswer } = req.body;

  if (!correctAnswer) {
    return res.status(400).json({
      message: "Choose a correct answer first."
    });
  }

  try {
    const [result] = await pool.query(
      `
        UPDATE polls
        SET correct_answer = ?, status = 'scored'
        WHERE poll_id = ? AND status = 'closed'
      `,
      [correctAnswer, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Closed poll not found."
      });
    }

    res.json({ message: "Result saved and poll settled." });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Could not save result." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'success',
      message: 'Database connection successful',
      serverTime: result.rows[0].now
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
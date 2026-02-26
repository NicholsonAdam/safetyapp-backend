const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'safetyApp',
  password: 'Sinderion1234321@@',
  port: 5432
});

module.exports = pool;
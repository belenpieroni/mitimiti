const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'mitimiti',
  user: process.env.DB_USER || 'mitimiti',
  password: process.env.DB_PASSWORD || 'mitimiti_dev',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function inicializarDB() {
  const schemaPath = path.join(__dirname, 'migrations', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  let retries = 12;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      try {
        await client.query(schema);
        console.log('✓ Base de datos inicializada correctamente');
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error('✗ No se pudo conectar a PostgreSQL:', err.message);
        throw err;
      }
      console.log(`⏳ Esperando PostgreSQL... (${retries} intentos restantes)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

module.exports = { pool, inicializarDB };

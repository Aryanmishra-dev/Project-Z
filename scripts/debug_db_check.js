const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  database: 'quiz_dev',
});

async function checkPdfs() {
  try {
    await client.connect();
    console.log('Connected to database');

    const res = await client.query(
      'SELECT id, filename, status, created_at, user_id FROM pdfs ORDER BY created_at DESC LIMIT 5'
    );
    console.log('Recent PDFs:');
    res.rows.forEach((row) => {
      console.log(
        `ID: ${row.id}, File: ${row.filename}, Status: ${row.status}, Created: ${row.created_at}, User: ${row.user_id}`
      );
    });

    // Check specifically for IDs ending in df065c11fb (from screenshot)
    const specificRes = await client.query("SELECT * FROM pdfs WHERE id LIKE '%df065c11fb'");
    if (specificRes.rows.length > 0) {
      console.log('\nFound matching PDF:');
      console.log(specificRes.rows[0]);
    } else {
      console.log('\nNo PDF found ending with df065c11fb');
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
}

checkPdfs();

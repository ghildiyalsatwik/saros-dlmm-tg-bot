import express from 'express';
import pkg from 'pg';
import 'dotenv/config';

const { Pool } = pkg;

const app = express();

app.use(express.json());

const PORT = process.env.SHAMIR_SERVER_2_PORT;

const pool = new Pool({ connectionString: process.env.SHAMIR_DB_2 });

app.post('/register', async (req, res) => {

    const { user_id, share } = req.body;
    
    await pool.query('INSERT INTO shamir_part (user_id, shamir_share) VALUES ($1, $2);', [user_id, share]);

    return res.sendStatus(200);

});

app.post('/get', async (req, res) => {

    const { user_id } = req.body;
    
    const result = await pool.query('SELECT shamir_share from shamir_part where user_id = $1', [user_id]);

    res.json({ share: result.rows[0].shamir_share });

});

app.listen(PORT, () => {

    console.log(`Shamir_2 server running on PORT: ${PORT}`)

});
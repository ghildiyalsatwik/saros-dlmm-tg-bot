import { connection } from "../utils/connection.js";
import { pool } from "../utils/main_db.js";
import { PublicKey } from "@solana/web3.js";

export const getSOLBalance = async (userId) => {

    console.log(`User: ${userId} wants to check their SOL balance.`);

    const { rows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);

    if(rows.length === 0) {

        return "You do not have a wallet yet, please create a wallet first!";
    
    }

    const user_public_key = new PublicKey(rows[0].pubkey);

    const balance = await connection.getBalance(user_public_key);
            
    return `Your wallet: ${rows[0].pubkey} has ${balance/1e9} SOL.`;

}
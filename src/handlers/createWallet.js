import sss from "shamirs-secret-sharing";
import { pool } from "../utils/main_db.js";
import { Keypair } from "@solana/web3.js";
import axios from "axios";

export const createWallet = async (userId) => {

    console.log(`Create wallet command called by the user: ${userId}`);

    const { rows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);

    if(rows.length > 0) {

        return `You already have a wallet!\nPublic key: ${rows[0].pubkey}`;
    
    } else {

        const kp = Keypair.generate();

        const secret = Buffer.from(kp.secretKey);

        const shares = sss.split(secret, {shares: 3, threshold: 3});

        await Promise.all([
            
            axios.post(process.env.SHAMIR_1_URL, { user_id: userId, share: shares[0].toString('hex') }),
            
            axios.post(process.env.SHAMIR_2_URL, { user_id: userId, share: shares[1].toString('hex') }),
            
            axios.post(process.env.SHAMIR_3_URL, { user_id: userId, share: shares[2].toString('hex') })
        
        ]);

        await pool.query('INSERT INTO USERS (telegram_user_id, pubkey) VALUES ($1, $2)', [userId, kp.publicKey.toBase58()]);

        return `Wallet has been created\nPublic key: ${kp.publicKey.toBase58()}`;
    
    }

}
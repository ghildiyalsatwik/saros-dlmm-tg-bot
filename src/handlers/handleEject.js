import { pool } from "../utils/main_db.js";
import axios from "axios";
import sss from "shamirs-secret-sharing";

export const handleEject = async (userId) => {

    console.log(`User: ${userId} wants their private key.`);

    const { rows: userRows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);
        
    if(userRows.length === 0) {
        
        return "You do not have a wallet yet, please create a wallet first!";
        
    }

    let responses

    try {

        responses = await Promise.all([

            axios.post(process.env.SHAMIR_1_GET_URL, { user_id: userId }),

            axios.post(process.env.SHAMIR_2_GET_URL, { user_id: userId }),

            axios.post(process.env.SHAMIR_3_GET_URL, { user_id: userId })
        
        ]);
        
    } catch(e) {

        return 'Error in retrieving your private key. Please try again later.'

    }

    console.log(responses);

    const shares = responses.map(resp => Buffer.from(resp.data.share, 'hex'));

    const secret = sss.combine(shares);

    const secretHex = secret.toString('hex');

    return `Here is your private key (please save it securely): \n${secretHex}`;

}
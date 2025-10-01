import { pool } from "../utils/main_db.js";
import { PublicKey, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import sss from "shamirs-secret-sharing";
import axios from "axios";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { connection } from "../utils/connection.js";

export const removeLiquidity = async (userId, positionPDA) => {

    const { rows: userRows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);
    
    if(userRows.length === 0) {
    
        return "You do not have a wallet yet, please create a wallet first!";
    
    }

    const payer = new PublicKey(userRows[0].pubkey);

    if(positionPDA === '') {

        return "Please specify the position you want to remove liquidity from.";
    }

    console.log(`User: ${userId} wants to remove their liquidity from position: ${positionPDA}.`);

    const { rows: positionRows } = await pool.query("SELECT pair, position_nft, min_bin, max_bin, base_token, quote_token from user_positions_history where position_pda = $1 and user_id = $2", [positionPDA, userId]);

    if(positionRows.length === 0) {

        return "You do not have any such position. Please try with a valid one!";
    }

    const pair = new PublicKey(positionRows[0].pair);

    const positionMint = positionRows[0].position_nft;

    const start = positionRows[0].min_bin;

    const end = positionRows[0].max_bin;

    const tokenMintX = new PublicKey(positionRows[0].base_token);

    const tokenMintY = new PublicKey(positionRows[0].quote_token);

    const responses = await Promise.all([

        axios.post(process.env.SHAMIR_1_GET_URL, { user_id: userId }),
                
        axios.post(process.env.SHAMIR_2_GET_URL, { user_id: userId }),
                
        axios.post(process.env.SHAMIR_3_GET_URL, { user_id: userId })
    
    ]);

    const shares = responses.map(resp => Buffer.from(resp.data.share, 'hex'));

    const secret = sss.combine(shares);

    const senderKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));

    const liquidityBookServices = new LiquidityBookServices({

        mode: MODE.DEVNET,
    
        options: {
    
            rpcUrl: "https://api.devnet.solana.com",
    
            commitmentOrConfig: "confirmed"
        }
    
    });

    const response = await liquidityBookServices.removeMultipleLiquidity({

        maxPositionList: [{

            position: positionPDA,

            start: start,

            end: end,

            positionMint: positionMint
        }],

        payer: payer,

        type: "removeBoth",

        pair: pair,

        tokenMintX: tokenMintX,

        tokenMintY: tokenMintY
    
    });


    if(response.txCreateAccount) {
        
        await sendAndConfirmTransaction(connection, response.txCreateAccount, [senderKeypair]);
    }
      
    for(const tx of response.txs) {
        
        await sendAndConfirmTransaction(connection, tx, [senderKeypair]);
      
    }


    if (response.txCloseAccount) {
        
        await sendAndConfirmTransaction(connection, response.txCloseAccount, [senderKeypair]);

    }

    await pool.query(
        
        `INSERT INTO user_positions_history (
            user_id,
            pair,
            position_nft,
            position_pda,
            min_bin,
            max_bin,
            base_token,
            quote_token,
            action_type
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
            userId,
            pair.toBase58(),
            positionMint,
            positionPDA,
            start,
            end,
            tokenMintX.toBase58(),
            tokenMintY.toBase58(),                     
            "close"
        ]
  
    );

    return `Liquidity has been removed from position: ${positionPDA}`;
}
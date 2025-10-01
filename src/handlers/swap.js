import { PublicKey, sendAndConfirmTransaction, Keypair } from "@solana/web3.js";
import sss from "shamirs-secret-sharing";
import axios from "axios";
import { pool } from "../utils/main_db.js";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { connection } from "../utils/connection.js";

export const swap = async (userId, from, to, amount) => {

    console.log(`User: ${userId} wants to swap ${from} for ${to}.`);

    const { rows: userRows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);
    
    if(userRows.length === 0) {
    
        return "You do not have a wallet yet, please create a wallet first!";
    
    }

    const payer = new PublicKey(userRows[0].pubkey);

    const { rows: fromRows } = await pool.query('SELECT mint_address, decimals from tokens where symbol = $1;', [from]);

    const fromAddress = fromRows[0].mint_address;

    const fromDecimals = fromRows[0].decimals;

    const { rows: toRows } = await pool.query('SELECT mint_address, decimals from tokens where symbol = $1;', [to]);

    const toAddress = toRows[0].mint_address;

    const toDecimals = toRows[0].decimals;

    const { rows: poolRows } = await pool.query("SELECT pair from pools where (base_token = $1 and quote_token = $2) OR (base_token = $2 AND quote_token = $1);", [fromAddress, toAddress]);

    const pair = new PublicKey(poolRows[0].pair);

    console.log(pair.toBase58(), fromAddress, toAddress);

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

    const rawAmount = Number(amount);

    let amountNum;

    try {

        amountNum = BigInt(Math.round(rawAmount * 10 ** fromDecimals));
    
    } catch(e) {

        return "The Saros DLMM bot could not parse the amount you entered. Please try again!";

    }

    const pairInfo = await liquidityBookServices.getPairAccount(pair);

    console.log(pairInfo);

    const tokenX = pairInfo.tokenMintX;

    const tokenY = pairInfo.tokenMintY;

    let swapForY;

    if(fromAddress === tokenX && toAddress === tokenY) {

        swapForY = true;
    
    } else {

        swapForY = false;
    }

    console.log("Swap happening From: ", fromAddress, " To: ", toAddress);

    console.log("swapforY: ", swapForY);

    console.log("TokenX: ", tokenX, " TokenY: ", tokenY);

    const quote = await liquidityBookServices.getQuote({

        amount: amountNum,
    
        isExactInput: true,
    
        swapForY,
    
        pair: pair,
    
        tokenBase: new PublicKey(tokenX),
    
        tokenQuote: new PublicKey(tokenY),
    
        tokenBaseDecimal: fromDecimals,
    
        tokenQuoteDecimal: toDecimals,
    
        slippage: 0.25
    
    });

    console.log(quote);

    let tx;

    try {
        
        tx = await liquidityBookServices.swap({

            amount: quote.amount,
        
            tokenMintX: new PublicKey(tokenX),
        
            tokenMintY: new PublicKey(tokenY),
        
            otherAmountOffset: quote.otherAmountOffset,
        
            isExactInput: true,
        
            swapForY: swapForY,
        
            pair: pair,
        
            payer: payer
        
        });

    } catch(err) {

        return "Error in getting quote from the Saros DLMM pool. Please try again!";
    }

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    tx.feePayer = payer;

    let sig;

    try {

        sig = await sendAndConfirmTransaction(connection, tx, [senderKeypair]);


    } catch(e) {

        return `Transaction failed: ${e.message || e}`;
    }

    return `${amount} of ${from} has been swapped for ${to}!.\n Transaction Hash: ${sig}`;
}
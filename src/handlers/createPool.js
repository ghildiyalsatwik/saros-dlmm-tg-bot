import { pool } from "../utils/main_db.js";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { PublicKey, sendAndConfirmTransaction, Keypair } from "@solana/web3.js";
import { connection } from "../utils/connection.js";
import axios from "axios";
import sss from "shamirs-secret-sharing";

export const createPool = async (userId, base_token, quote_token, bin_step, rate_price) => {

    console.log(`User: ${userId} wants to create a pool.`);

    console.log(base_token, quote_token, bin_step, rate_price);

    const { rows: userRows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);

    if(userRows.length === 0) {

        return "You do not have a wallet yet, please create a wallet first!";
    
    }


    if (base_token === '' && quote_token === '' && bin_step === '' && rate_price === '') {
        
        return "Please specify base token, quote token, bin step and rate price.";
    
    } else if (base_token === '' && quote_token === '' && bin_step === '') {
        
        return "Please specify base token, quote token, and bin step.";
    
    } else if (base_token === '' && quote_token === '' && rate_price === '') {
        
        return "Please specify base token, quote token, and rate price.";
    
    } else if (base_token === '' && bin_step === '' && rate_price === '') {
        
        return "Please specify base token, bin step and rate price.";
    
    } else if (quote_token === '' && bin_step === '' && rate_price === '') {
        
        return "Please specify quote token, bin step and rate price.";
    
    } else if (base_token === '' && quote_token === '') {
        
        return "Please specify base token and quote token.";
    
    } else if (base_token === '' && bin_step === '') {
        
        return "Please specify base token and bin step.";
    
    } else if (base_token === '' && rate_price === '') {
        
        return "Please specify base token and rate price.";
    
    } else if (quote_token === '' && bin_step === '') {
        
        return "Please specify quote token and bin step.";
    
    } else if (quote_token === '' && rate_price === '') {
        
        return "Please specify quote token and rate price.";
    
    } else if (bin_step === '' && rate_price === '') {
        
        return "Please specify bin step and rate price.";
    
    } else if (base_token === '') {
        
        return "Please specify base token.";
    
    } else if (quote_token === '') {
        
        return "Please specify quote token.";
    
    } else if (bin_step === '') {
        
        return "Please specify bin step.";
    
    } else if (rate_price === '') {
        
        return "Please specify rate price.";
    
    }

    const userPubkey = new PublicKey(userRows[0].pubkey);

    const { rows: baseRows } = await pool.query('SELECT mint_address, decimals from tokens where symbol = $1;', [base_token]);

    const baseMint = baseRows[0].mint_address;

    const baseDecimals = baseRows[0].decimals;

    console.log(typeof baseDecimals);

    const { rows: quoteRows } = await pool.query('SELECT mint_address, decimals from tokens where symbol = $1;', [quote_token]);

    const quoteMint = quoteRows[0].mint_address;

    const quoteDecimals = quoteRows[0].decimals;

    console.log(typeof quoteDecimals);

    const binStep = Number(bin_step);

    const ratePrice = Number(rate_price);

    console.log(baseMint, quoteMint, binStep, ratePrice);

    const liquidityBookServices = new LiquidityBookServices({

        mode: MODE.DEVNET,
    
        options: {
    
            rpcUrl: "https://api.devnet.solana.com",
    
            commitmentOrConfig: "confirmed"
        }
    
    });


    const { tx, pair, binArrayLower, binArrayUpper, activeBin } = await liquidityBookServices.createPairWithConfig({

        tokenBase: {

            decimal: baseDecimals,

            mintAddress: baseMint
        },

        tokenQuote: {

            decimal: quoteDecimals,

            mintAddress: quoteMint
        },

        binStep: binStep,

        ratePrice: ratePrice,

        payer: userPubkey

    });

    const responses = await Promise.all([

        axios.post(process.env.SHAMIR_1_GET_URL, { user_id: userId }),
                
        axios.post(process.env.SHAMIR_2_GET_URL, { user_id: userId }),
                
        axios.post(process.env.SHAMIR_3_GET_URL, { user_id: userId })
    
    ]);

    const shares = responses.map(resp => Buffer.from(resp.data.share, 'hex'));

    const secret = sss.combine(shares);

    const senderKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    tx.recentBlockhash = blockhash;

    tx.feePayer = userPubkey;

    let sig;

    try {

        sig = await sendAndConfirmTransaction(connection, tx, [senderKeypair]);


    } catch(e) {

        return `Transaction failed: ${e.message || e}`;
    }


    console.log(`Pair: ${pair}, activeBin: ${activeBin}, binArrayLower: ${binArrayLower}, binArrayUpper: ${binArrayUpper}`);

    
    await pool.query('INSERT INTO pools (pair, base_token, quote_token) VALUES ($1, $2, $3)', [pair, baseMint, quoteMint]);


    await pool.query('INSERT INTO user_pools (pair, base_token, quote_token, bin_step, rate_price, active_bin, bin_array_lower, bin_array_upper, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [pair, baseMint, quoteMint, binStep, ratePrice, activeBin, binArrayLower, binArrayUpper, userId]);


    return `Pool between ${base_token} and ${quote_token} with binStep ${binStep} and ratePrice ${rate_price} has been created at ${pair}!\n Transaction Hash: ${sig}\n Please make reference to this pool to open positions and add liquidity.`;

}
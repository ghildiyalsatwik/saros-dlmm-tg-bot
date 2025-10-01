import { pool } from "../utils/main_db.js";
import { PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { connection } from "../utils/connection.js";
import { getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID, createInitializeMint2Instruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMintToInstruction } from "@solana/spl-token";
import { Transaction, Keypair, SystemProgram } from "@solana/web3.js";
import sss from "shamirs-secret-sharing";
import BN from "bn.js";
import axios from "axios";

export const mintToken = async (userId, name, symbol, decimals, initial_amount) => {

    console.log(`User: ${userId} wants to mint a new token.`);

    const { rows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);

    if(rows.length === 0) {

        return "You do not have a wallet yet, please create a wallet first!";
    
    }

    if (name === '' && symbol === '' && decimals === '' && initial_amount === '') {
        
        return "Please specify token name, symbol, decimals and amount you want minted to your wallet.";
    
    } else if (name === '' && symbol === '' && decimals === '') {
        
        return "Please specify token name, symbol, and token decimals.";
    
    } else if (name === '' && symbol === '' && initial_amount === '') {
        
        return "Please specify token name, symbol, and initial amount.";
    
    } else if (name === '' && decimals === '' && initial_amount === '') {
        
        return "Please specify token name, decimals and initial amount.";
    
    } else if (symbol === '' && decimals === '' && initial_amount === '') {
        
        return "Please specify token symbol, decimals and amount you want minted to your wallet.";
    
    } else if (name === '' && symbol === '') {
        
        return "Please specify token name and symbol.";
    
    } else if (name === '' && decimals === '') {
        
        return "Please specify token name and decimals.";
    
    } else if (name === '' && initial_amount === '') {
        
        return "Please specify token name and initial amount.";
    
    } else if (symbol === '' && decimals === '') {
        
        return "Please specify token symbol and decimals.";
    
    } else if (symbol === '' && initial_amount === '') {
        
        return "Please specify token symbol and initial amount.";
    
    } else if (decimals === '' && initial_amount === '') {
        
        return "Please specify token decimals and initial amount.";
    
    } else if (name === '') {
        
        return "Please specify token name.";
    
    } else if (symbol === '') {
        
        return "Please specify token symbol.";
    
    } else if (decimals === '') {
        
        return "Please specify token decimals.";
    
    } else if (initial_amount === '') {
        
        return "Please specify the initial amount you want minted to your wallet.";
    
    }

    const user_public_key = new PublicKey(rows[0].pubkey);

    const decimalsNum = Number(decimals);

    const initial_amount_num = Number(initial_amount);

    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    const tx = new Transaction();

    const mintKeypair = Keypair.generate();

    tx.add(

        SystemProgram.createAccount({

            fromPubkey: user_public_key,

            newAccountPubkey: mintKeypair.publicKey,

            space: MINT_SIZE,

            lamports: lamports,

            programId: TOKEN_PROGRAM_ID
        })
    );

    tx.add(

        createInitializeMint2Instruction(mintKeypair.publicKey, decimalsNum, user_public_key, user_public_key, TOKEN_PROGRAM_ID)
    
    );

    const userATA = await getAssociatedTokenAddress(mintKeypair.publicKey, user_public_key, false, TOKEN_PROGRAM_ID);

    tx.add(

        createAssociatedTokenAccountInstruction(

            user_public_key,

            userATA,

            user_public_key,

            mintKeypair.publicKey,

            TOKEN_PROGRAM_ID

        )
    );

    const mintAmount = new BN(initial_amount_num).mul(new BN(10).pow(new BN(decimalsNum)));

    tx.add(

        createMintToInstruction(

            mintKeypair.publicKey,

            userATA,

            user_public_key,

            mintAmount,

            [],

            TOKEN_PROGRAM_ID

        )
    );

    tx.feePayer = user_public_key;


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

    let sig;

    try {

        sig = await sendAndConfirmTransaction(connection, tx, [senderKeypair, mintKeypair]);


    } catch(e) {

        return `Transaction failed: ${e.message || e}`;

    }


    await pool.query('INSERT INTO tokens (mint_address, name, symbol, decimals) VALUES ($1, $2, $3, $4)', [mintKeypair.publicKey.toBase58(), name, symbol, decimalsNum]);

    await pool.query('INSERT INTO user_tokens (mint_address, name, symbol, decimals, user_id, mint_amount) VALUES ($1, $2, $3, $4, $5, $6)', [mintKeypair.publicKey.toBase58(), name, symbol, decimalsNum, userId, initial_amount_num]);
    
    return `${symbol} has been created and ${initial_amount} of tokens have been minted to your wallet!\nTransaction Hash: ${sig}.`;

}
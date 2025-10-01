import { Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import sss from "shamirs-secret-sharing";
import axios from "axios";
import { pool } from "../utils/main_db.js";
import { LiquidityBookServices, MODE, LiquidityShape, createUniformDistribution } from "@saros-finance/dlmm-sdk";
import { connection } from "../utils/connection.js";
import BN from "bn.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

export const addLiquidity = async (userId, pair, shape, base_amount, quote_amount, min_bin, max_bin) => {

    console.log(`User: ${userId} wants to open a position.`);

    console.log(`shape: ${shape}, min_bin: ${min_bin}, max_bin: ${max_bin}`);

    const { rows: userRows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);

    if(userRows.length === 0) {

        return "You do not have a wallet yet, please create a wallet first!";
    
    }

    const payer = new PublicKey(userRows[0].pubkey);

    if (pair === '' && shape === '' && base_amount === '' && quote_amount === '' && min_bin === '' && max_bin === '') {
        
        return "Please specify pair, shape, base amount, quote amount, and bin range.";
    
    } else if (pair === '' && shape === '' && base_amount === '') {
        
        return "Please specify pair, shape, and base amount.";
    
    } else if (pair === '' && shape === '' && quote_amount === '') {
        
        return "Please specify pair, shape, and quote amount.";
    
    } else if (pair === '' && shape === '' && min_bin === '') {
        
        return "Please specify pair, shape, and min bin.";
    
    } else if (pair === '' && shape === '' && max_bin === '') {
        
        return "Please specify pair, shape, and max bin.";
    
    } else if (pair === '' && base_amount === '' && quote_amount === '') {
        
        return "Please specify pair, base amount, and quote amount.";
    
    } else if (pair === '' && base_amount === '' && min_bin === '') {
        
        return "Please specify pair, base amount, and min bin.";
    
    } else if (pair === '' && base_amount === '' && max_bin === '') {
        
        return "Please specify pair, base amount, and max bin.";
    
    } else if (pair === '' && quote_amount === '' && min_bin === '') {
        
        return "Please specify pair, quote amount, and min bin.";
    
    } else if (pair === '' && quote_amount === '' && max_bin === '') {
        
        return "Please specify pair, quote amount, and max bin.";
    
    } else if (pair === '' && min_bin === '' && max_bin === '') {
        
        return "Please specify pair, min bin, and max bin.";
    
    } else if (shape === '' && base_amount === '' && quote_amount === '') {
        
        return "Please specify shape, base amount, and quote amount.";
    
    } else if (shape === '' && base_amount === '' && min_bin === '') {
        
        return "Please specify shape, base amount, and min bin.";
    
    } else if (shape === '' && base_amount === '' && max_bin === '') {
        
        return "Please specify shape, base amount, and max bin.";
    
    } else if (shape === '' && quote_amount === '' && min_bin === '') {
        
        return "Please specify shape, quote amount, and min bin.";
    
    } else if (shape === '' && quote_amount === '' && max_bin === '') {
        
        return "Please specify shape, quote amount, and max bin.";
    
    } else if (shape === '' && min_bin === '' && max_bin === '') {
        
        return "Please specify shape, min bin, and max bin.";
    
    } else if (base_amount === '' && quote_amount === '' && min_bin === '') {
        
        return "Please specify base amount, quote amount, and min bin.";
    
    } else if (base_amount === '' && quote_amount === '' && max_bin === '') {
        
        return "Please specify base amount, quote amount, and max bin.";
    
    } else if (base_amount === '' && min_bin === '' && max_bin === '') {
        
        return "Please specify base amount, min bin, and max bin.";
    
    } else if (quote_amount === '' && min_bin === '' && max_bin === '') {
        
        return "Please specify quote amount, min bin, and max bin.";
    
    } else if (pair === '') {
        
        return "Please specify the pool pair address.";
    
    } else if (shape === '') {
        
        return "Please specify the liquidity distribution shape (spot, curve, bidask, or uniform).";
    
    } else if (base_amount === '') {
        
        return "Please specify the base token amount.";
    
    } else if (quote_amount === '') {
        
        return "Please specify the quote token amount.";
    
    } else if (min_bin === '') {
        
        return "Please specify the minimum bin offset.";
    
    } else if (max_bin === '') {
        
        return "Please specify the maximum bin offset.";
    }

    const { rows: pairRows } = await pool.query('SELECT pair, quote_token, base_token from pools where pair = $1;', [pair]);

    if(pairRows.length === 0) {

        return "No such pool exists! Please specify a valid pool!";
    
    }

    const quote_address = pairRows[0].quote_token;

    const base_address = pairRows[0].base_token;

    const { rows: quoteRows } = await pool.query("SELECT decimals from tokens where mint_address = $1;", [quote_address]);

    const quote_decimals = quoteRows[0].decimals;

    const { rows: baseRows } = await pool.query("SELECT decimals from tokens where mint_address = $1;", [base_address]);

    const base_decimals = baseRows[0].decimals;

    const liquidityBookServices = new LiquidityBookServices({

        mode: MODE.DEVNET,
    
        options: {
    
            rpcUrl: "https://api.devnet.solana.com",
    
            commitmentOrConfig: "confirmed"
        }
    
    });

    const pairPubkey = new PublicKey(pair);

    const pairInfo = await liquidityBookServices.getPairAccount(pair);

    const activeBin = pairInfo.activeId;

    const binArrayIndex = Math.floor(activeBin/256);

    const minBin = Number(min_bin);

    const maxBin = Number(max_bin);

    console.log(minBin, maxBin);

    const responses = await Promise.all([

        axios.post(process.env.SHAMIR_1_GET_URL, { user_id: userId }),
                
        axios.post(process.env.SHAMIR_2_GET_URL, { user_id: userId }),
                
        axios.post(process.env.SHAMIR_3_GET_URL, { user_id: userId })
    
    ]);

    const shares = responses.map(resp => Buffer.from(resp.data.share, 'hex'));

    const secret = sss.combine(shares);

    const senderKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));

    let WSOLFlag = false;

    let wsolAccount;

    const wsolATA = await getAssociatedTokenAddress(new PublicKey(quote_address), payer);

    console.log(wsolATA.toBase58());

    try {

        wsolAccount = await getAccount(connection, wsolATA);

        WSOLFlag = true;
    
    } catch(err) {

        console.log("WSOL ATA does not exist.");
    }

    if(quote_address === 'So11111111111111111111111111111111111111112' && WSOLFlag === false) {

        console.log(WSOLFlag, "Creating tx to create the ATA");

        const wsolTx = new Transaction();

        wsolTx.add(

            createAssociatedTokenAccountInstruction(payer, wsolATA, payer, new PublicKey(quote_address))
        );

        try {
            
            await sendAndConfirmTransaction(connection, wsolTx, [senderKeypair]);

        } catch(e) {

            return `Transaction failed: ${e.message || e}`;
        }

        console.log("WSOL ATA created for the user.");
    }

    const initTx = new Transaction();

    await liquidityBookServices.getPairVaultInfo({ tokenAddress: pairInfo.tokenMintX, pair: pairPubkey, payer, transaction: initTx });
    
    await liquidityBookServices.getPairVaultInfo({ tokenAddress: pairInfo.tokenMintY, pair: pairPubkey, payer, transaction: initTx });
    
    await liquidityBookServices.getUserVaultInfo({ tokenAddress: pairInfo.tokenMintX, payer, transaction: initTx });
    
    await liquidityBookServices.getUserVaultInfo({ tokenAddress: pairInfo.tokenMintY, payer, transaction: initTx });


    if(initTx.instructions.length) {
        
        initTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        initTx.feePayer = payer;
        
        await sendAndConfirmTransaction(connection, initTx, [senderKeypair]);
        
        console.log("Vaults initialized.");
    }

    let positionNFT;

    let positionPDA;

    let acc;


    for(let attempt = 0; attempt < 3; attempt++) {
        
        positionNFT = Keypair.generate();
        
        positionPDA = PublicKey.findProgramAddressSync(
          
            [Buffer.from("position"), positionNFT.publicKey.toBuffer()],
          
            liquidityBookServices.lbProgram.programId
        
        )[0];
    
        const createTx = new Transaction();

        await liquidityBookServices.createPosition({
          
            payer,
          
            pair: pairPubkey,
          
            relativeBinIdLeft: minBin,
          
            relativeBinIdRight: maxBin,
          
            binArrayIndex,
          
            positionMint: positionNFT.publicKey,
          
            transaction: createTx,
        
        });
    
        if(createTx.instructions.length === 0) {
          
            console.warn("CreatePosition produced no instructions, retrying with a new mint...");
          
            continue;
        
        }
    
        createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        createTx.feePayer = payer;

        await sendAndConfirmTransaction(connection, createTx, [senderKeypair, positionNFT], { commitment: "finalized" });
        
        console.log("Position created! Position NFT: ", positionNFT.publicKey.toBase58());
        
        acc = await connection.getAccountInfo(positionPDA);

        if(acc && acc.owner.equals(liquidityBookServices.lbProgram.programId)) break;
        
        console.warn("Position PDA not created correctly, retrying...");
      
    }
    
    if(!acc) return "Failed to create position PDA after retries. Please try again!";
    
    console.log("Position PDA:", positionPDA.toBase58(), "Owner:", acc.owner.toBase58());

    const binRange = [minBin, maxBin];

    const finalShape = (shape === 'uniform' || shape === 'spot') ? LiquidityShape.Spot : shape === 'curve' ? LiquidityShape.Curve : LiquidityShape.BidAsk;

    const liquidityDistribution = createUniformDistribution({
        
        shape: finalShape,
        
        binRange,
    
    });

    console.log(liquidityDistribution);

    console.log("The active bin is: ", activeBin);

    const minBinIndex = activeBin + minBin;

    const maxBinIndex = activeBin + maxBin;

    console.log("minBinIndex: ", minBinIndex, "maxBinIndex: ", maxBinIndex);

    const minArrayIndex = Math.floor(minBinIndex/256);
    
    const maxArrayIndex = Math.floor(maxBinIndex/256);

    console.log("minArrayIndex: ", minArrayIndex, "Max Array Index: ", maxArrayIndex);

    const binArrayTx = new Transaction();

    const binArrayLower = await liquidityBookServices.getBinArray({
        
        binArrayIndex: minArrayIndex,
        
        pair: pairPubkey,
        
        payer,
        
        transaction: binArrayTx,
    
    });

    let binArrayUpper = binArrayLower;

    if(maxArrayIndex !== minArrayIndex) {
        
        binArrayUpper = await liquidityBookServices.getBinArray({
          
            binArrayIndex: maxArrayIndex,
          
            pair: pairPubkey,
          
            payer,
          
            transaction: binArrayTx,
        
        });
      
    };


    if(binArrayTx.instructions.length) {

        console.log('Sending the tx to initialze bin arrays.');
        
        binArrayTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        binArrayTx.feePayer = payer;
        
        try {
            
            await sendAndConfirmTransaction(connection, binArrayTx, [senderKeypair]);

        } catch(e) {

            return `Transaction failed: ${e.message || e}`;
        }
        
        console.log("Bin arrays initialized if missing.");
    
    };

    console.log(binArrayUpper.toBase58(), binArrayLower.toBase58());

    let amountX;

    let amountY;

    try {

        amountX = BigInt(Math.round(Number(quote_amount) * 10 ** quote_decimals));

        amountY = BigInt(Math.round(Number(base_amount) * 10 ** base_decimals));


    } catch(err) {

        return "The Saros DLMM bot could not parse the amounts you entered. Please try again!";
    }

    const addTx = new Transaction();

    console.log('Creating the final add liquidity tx.');

    console.log(binArrayLower, binArrayUpper);
    
    await liquidityBookServices.addLiquidityIntoPosition({
      
        positionMint: positionNFT.publicKey,
      
        payer,
      
        pair: pairPubkey,
      
        transaction: addTx,
      
        liquidityDistribution,
      
        amountX: new BN(amountX),
      
        amountY: new BN(amountY),
      
        binArrayLower,
      
        binArrayUpper,
    
    });

    addTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    addTx.feePayer = payer;
    
    const sig = await sendAndConfirmTransaction(connection, addTx, [senderKeypair]);
    
    console.log("Liquidity added! Tx:", sig);

    const posAcc = await liquidityBookServices.lbProgram.account.position.fetch(positionPDA);
    
    console.log("Position liquidity shares:", posAcc.liquidityShares);  

    await pool.query(
        
        `INSERT INTO user_positions_history (
            user_id,
            pair,
            position_nft,
            position_pda,
            active_bin,
            bin_array_lower,
            bin_array_upper,
            min_bin,
            max_bin,
            base_token,
            quote_token,
            base_amount,
            quote_amount,
            action_type,
            liquidity_distribution
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
            userId,
            pair,
            positionNFT.publicKey.toBase58(),
            positionPDA.toBase58(),
            activeBin,
            binArrayLower.toBase58(),
            binArrayUpper.toBase58(),
            minBinIndex,
            maxBinIndex,
            pairInfo.tokenMintX.toBase58(),
            pairInfo.tokenMintY.toBase58(),
            Number(base_amount),                         
            Number(quote_amount),                         
            "add",                           
            JSON.stringify(liquidityDistribution)
        ]
  
    );
  
    
    return `Liquidity added successfully!\nTx: ${sig}\nYour Position PDA: ${positionPDA.toBase58()} and your position NFT: ${positionNFT.publicKey.toBase58()}\n Please refer to this position PDA to add or remove liquidity from this position`;

}
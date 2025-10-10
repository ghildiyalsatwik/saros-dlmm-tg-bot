import { pool } from "../utils/main_db.js";
import { LiquidityBookServices, MODE, LiquidityShape, createUniformDistribution } from "@saros-finance/dlmm-sdk";
import { connection } from "../utils/connection.js";
import bot from "../utils/bot.js";
import { PublicKey, Keypair, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import sss from "shamirs-secret-sharing";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getAccount, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import BN from "bn.js";
import axios from "axios";
import { error } from "console";

export const manageUserPositionsService = async () => {

    const { rows: managedPositions } = await pool.query("SELECT * from manage_user_positions;");

    if(managedPositions.length === 0) {

        console.log("No positions found to manage!");

        return;
    }


    const liquidityBookServices = new LiquidityBookServices({
        
        mode: MODE.DEVNET,
        
        options: {
        
            rpcUrl: "https://api.devnet.solana.com",
        
            commitmentOrConfig: "confirmed"
        }
        
    });


    const currentSlot = await connection.getSlot();

    for(const position of managedPositions) {

        const { 

            user_id,
            chat_id,
            pair,
            position_pda,
            last_active_bin,
            last_slot,
            min_bin,
            max_bin,
            base_token,
            quote_token,
            base_amount,
            quote_amount,
            position_nft,
            liquidity_distribution
         
        } = position;

        const { rows: users } = await pool.query("SELECT pubkey FROM users where telegram_user_id = $1", [Number(user_id)]);

        if(users.length === 0) {

            console.log(`User: ${user_id} not found in the users table!`);

            continue;
        }

        const payer = new PublicKey(users[0].pubkey);

        const pairPubkey = new PublicKey(pair);

        const poolInfo = await liquidityBookServices.getPairAccount(pairPubkey);

        const activeBin = Number(poolInfo.activeId);

        const slotDiff = currentSlot - Number(last_slot);

        const binShift = Math.abs(activeBin - Number(last_active_bin));

        console.log("Bin shift: ", binShift, " slot diff: ", slotDiff);

        if(binShift > 0 && slotDiff >= 1) {

            console.log(`Position ${position_pda} moved from ${last_active_bin} to ${activeBin}, closing older position and opening a new one.`);

            await pool.query("DELETE FROM manage_user_positions WHERE position_pda = $1", [position_pda]);

            console.log(`Deleted ${position_pda} from management table.`);

            const closeResponse = await liquidityBookServices.removeMultipleLiquidity({

                maxPositionList: [{

                    position: position_pda,

                    start: min_bin,

                    end: max_bin,

                    positionMint: position_nft

                }],

                payer: payer,

                type: "removeBoth",

                pair: pairPubkey,

                tokenMintX: new PublicKey(base_token),

                tokenMintY: new PublicKey(quote_token)

            });


            const responses = await Promise.all([

                axios.post(process.env.SHAMIR_1_GET_URL, { user_id: Number(user_id) }),
                        
                axios.post(process.env.SHAMIR_2_GET_URL, { user_id: Number(user_id) }),
                        
                axios.post(process.env.SHAMIR_3_GET_URL, { user_id: Number(user_id) })
            
            ]);
        
            const shares = responses.map(resp => Buffer.from(resp.data.share, 'hex'));
        
            const secret = sss.combine(shares);
        
            const senderKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));

            console.log(senderKeypair.publicKey.toBase58(), payer.toBase58());

            if(closeResponse.txCreateAccount) {


                try {
        
                    await sendAndConfirmTransaction(connection, closeResponse.txCreateAccount, [senderKeypair]);

                } catch(e) {

                    bot.sendMessage(Number(chat_id), `Transaction failed: ${e.message || e}`);

                    continue;
                }

                console.log("First txn successfull!");
            }

            let txIdx = 0;
              
            for(const tx of closeResponse.txs) {

                try {
                
                    await sendAndConfirmTransaction(connection, tx, [senderKeypair]);

                } catch(e) {

                    bot.sendMessage(Number(chat_id), `Transaction failed: ${e.message || e}`);

                    continue;
                
                }

                console.log(`Txn index ${txIdx} of txn successful!`);

                txIdx++;
              
            }
        
        
            if (closeResponse.txCloseAccount) {

                try {
                
                    await sendAndConfirmTransaction(connection, closeResponse.txCloseAccount, [senderKeypair]);

                } catch(e) {

                    bot.sendMessage(Number(chat_id), `Transaction failed: ${e.message || e}`);

                    continue;

                }

                console.log("Third Txn successfull!");
        
            }

            console.log(`Position: ${position_pda} closed.`);

            await bot.sendMessage(Number(chat_id), `Position: ${position_pda} closed. Old active bin was ${last_active_bin}, new active bin is: ${activeBin}`);

            console.log(`Trying to open a new position around the new active bin: ${activeBin}`);

            const { rows: quoteRows } = await pool.query("SELECT decimals from tokens where mint_address = $1;", [quote_token]);

            const quote_decimals = quoteRows[0].decimals;

            const { rows: baseRows } = await pool.query("SELECT decimals from tokens where mint_address = $1;", [base_token]);

            const base_decimals = baseRows[0].decimals;

            const binArrayIndex = Math.floor(activeBin/256);

            const minBinIdx = Number(min_bin);

            const maxBinIdx = Number(max_bin);

            const minBin = minBinIdx - Number(last_active_bin);

            const maxBin = maxBinIdx - Number(last_active_bin);

            console.log("minBin: ", minBin, " maxBin: ", maxBin);

            console.log(typeof minBin, minBin, typeof maxBin, maxBin);

            // let WSOLFlag = false;

            // let wsolAccount;

            console.log(quote_token);

            //const wsolATA = await getAssociatedTokenAddress(new PublicKey(quote_token), payer);

            const wsolATA = await getOrCreateAssociatedTokenAccount(connection, senderKeypair, new PublicKey(quote_token), payer);

            console.log(wsolATA.address.toBase58());

            console.log("getOrCreateAssociatedTokenAccount function call successful!");

            // try {

            //     console.log("Seeing if WSOL ATA exists.");

            //     wsolAccount = await getAccount({
                    
            //         connection: connection,
                    
            //         address: wsolATA
                
            //     });

            //     WSOLFlag = true;

            //     console.log("WSOL ATA exists!");
            
            // } catch(err) {

            //     console.log("Error in getAccount function call.");
            // }

            // if(quote_token === 'So11111111111111111111111111111111111111112' && WSOLFlag === false) {

            //     console.log(WSOLFlag, "Creating tx to create the ATA");

            //     const wsolTx = new Transaction();

            //     wsolTx.add(

            //         createAssociatedTokenAccountInstruction(payer, wsolATA, payer, new PublicKey(quote_token))
            //     );

            //     try {
                    
            //         await sendAndConfirmTransaction(connection, wsolTx, [senderKeypair]);

            //     } catch(e) {

            //         console.log(e);

            //         bot.sendMessage(Number(chat_id), `Transaction failed: ${e.message || e}`);

            //         continue;
            //     }

            //     console.log("WSOL ATA created for the user.");
            // }

            const initTx = new Transaction();

            await liquidityBookServices.getPairVaultInfo({ tokenAddress: poolInfo.tokenMintX, pair: pairPubkey, payer: payer, transaction: initTx });
            
            await liquidityBookServices.getPairVaultInfo({ tokenAddress: poolInfo.tokenMintY, pair: pairPubkey, payer: payer, transaction: initTx });
            
            await liquidityBookServices.getUserVaultInfo({ tokenAddress: poolInfo.tokenMintX, payer: payer, transaction: initTx });
            
            await liquidityBookServices.getUserVaultInfo({ tokenAddress: poolInfo.tokenMintY, payer: payer, transaction: initTx });


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
                
                    payer: payer,
                
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
            
            if(!acc) {

                bot.sendMessage(Number(chat_id), "Failed to create position PDA after retries. Please try again!");
                
                continue;

            }
            
            console.log("Position PDA:", positionPDA.toBase58(), "Owner:", acc.owner.toBase58());

            const binRange = [minBin, maxBin];

            console.log(binRange);

            const newShape = LiquidityShape.Spot;

            const liquidityDistribution = createUniformDistribution({
                
                shape: newShape, 
                
                binRange: binRange}
            
            );

            const minBinIndex = Number(last_active_bin) + minBin;

            const maxBinIndex = Number(last_active_bin) + maxBin;

            console.log("minBinIndex: ", minBinIndex, "maxBinIndex: ", maxBinIndex);

            const minArrayIndex = Math.floor(minBinIndex/256);
    
            const maxArrayIndex = Math.floor(maxBinIndex/256);

            console.log("minArrayIndex: ", minArrayIndex, "Max Array Index: ", maxArrayIndex);

            const binArrayTx = new Transaction();

            const binArrayLower = await liquidityBookServices.getBinArray({
                
                binArrayIndex: minArrayIndex,
                
                pair: pairPubkey,
                
                payer: payer,
                
                transaction: binArrayTx,
            
            });

            let binArrayUpper = binArrayLower;

            if(maxArrayIndex !== minArrayIndex) {
                
                binArrayUpper = await liquidityBookServices.getBinArray({
                
                    binArrayIndex: maxArrayIndex,
                
                    pair: pairPubkey,
                
                    payer: payer,
                
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

                    bot.sendMessage(Number(chat_id), `Transaction failed: ${e.message || e}`);

                    continue;
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

                bot.sendMessage(Number(chat_id), "The Saros DLMM bot could not parse the amounts you entered. Please try again!");

                continue;
            }

            const addTx = new Transaction();

            console.log('Creating the final add liquidity tx.');

            console.log(binArrayLower, binArrayUpper);

            await liquidityBookServices.addLiquidityIntoPosition({
      
                positionMint: positionNFT.publicKey,
              
                payer: payer,
              
                pair: pairPubkey,
              
                transaction: addTx,
              
                liquidityDistribution,
              
                amountX: new BN(amountX),
              
                amountY: new BN(amountY),
              
                binArrayLower: binArrayLower,
              
                binArrayUpper: binArrayUpper,
            
            });
        
            addTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            
            addTx.feePayer = payer;

            let sig;

            try {
            
                sig = await sendAndConfirmTransaction(connection, addTx, [senderKeypair]);

            } catch(e) {

                bot.sendMessage(Number(chat_id), `Transaction failed: ${e.message || e}`);

                continue;

            }
            
            console.log("Liquidity added! Tx:", sig);
        
            const posAcc = await liquidityBookServices.lbProgram.account.position.fetch(positionPDA);
            
            console.log("Position liquidity shares:", posAcc.liquidityShares);

            bot.sendMessage(Number(chat_id), `A similar position has been opened and liquidity added successfully around the new active bin: ${activeBin}!\nTx: ${sig}\nYour Position PDA: ${positionPDA.toBase58()}.\nYour position NFT: ${positionNFT.publicKey.toBase58()}\n Please refer to this position PDA to add or remove liquidity from this position`);

        } else {

            console.log(`Bin for position ${position_pda} has not shifted or one slot has not passed since!`);
        
        }

    }

}
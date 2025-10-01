import { pool } from "../utils/main_db.js";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { PublicKey } from "@solana/web3.js";

export const subscribe = async (userId, pair, chat_id) => {

    console.log(`User: ${userId} wants to subscribe to the pool: ${pair}`);

    const { rows: pools } = await pool.query("SELECT * from pools WHERE pair = $1;", [pair]);

    if(pools.length === 0) {

        return "No such pool exists!";
    }

    const { rows } = await pool.query("SELECT pair from user_pool_subscriptions WHERE user_id = $1 and pair = $2;", [userId, pair]);

    if(rows.length !== 0) {

        return "You have already subscribed to this pool!";
    }

    const liquidityBookServices = new LiquidityBookServices({
    
            mode: MODE.DEVNET,
        
            options: {
        
                rpcUrl: "https://api.devnet.solana.com",
        
                commitmentOrConfig: "confirmed"
            }
        
    });

    const pairInfo = await liquidityBookServices.getPairAccount(new PublicKey(pair));

    const activeBin = pairInfo.activeId;

    await pool.query(
        
        `INSERT INTO user_pool_subscriptions (user_id, pair, last_active_bin, chat_id) VALUES ($1, $2, $3, $4);`,
        
        [userId, pair, activeBin, chat_id]
    );


    return `You have subscribed for updates to the pool: ${pair}.\nYou will get a message if the active bin changes!\nCurrent active bin is: ${activeBin}`;
}
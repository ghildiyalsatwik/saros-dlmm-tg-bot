import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { connection } from "../utils/connection.js";
import { pool } from "../utils/main_db.js";
import bot from "../utils/bot.js";
import { PublicKey } from "@solana/web3.js";
const liquidityBookServices = new LiquidityBookServices({

    mode: MODE.DEVNET,

    options: {

        rpcUrl: "https://api.devnet.solana.com",

        commitmentOrConfig: "confirmed"
    }

});

export const checkBinsAndNotify = async () => {

    const { rows: subs } = await pool.query("SELECT * from user_pool_subscriptions");

    if(subs.length === 0) console.log("No subscribed positions found!");

    for(const sub of subs) {

        const pairInfo = await liquidityBookServices.getPairAccount(new PublicKey(sub.pair));

        const currentBin = Number(pairInfo.activeId);

        console.log(sub.last_active_bin, currentBin);

        if(Number(sub.last_active_bin) !== currentBin) {

            console.log('Active bin changed.');

            await bot.sendMessage(sub.chat_id, `Active bin changed for pool: ${sub.pair}\nOld: ${sub.last_active_bin}\nNew: ${currentBin}`);

            await pool.query("UPDATE user_pool_subscriptions SET last_active_bin = $1 WHERE user_id = $2 AND pair = $3 and chat_id = $4;", [currentBin, sub.user_id, sub.pair, sub.chat_id]);
        }

    }
}
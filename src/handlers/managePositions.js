import { PublicKey } from "@solana/web3.js";
import { pool } from "../utils/main_db.js";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { connection } from "../utils/connection.js";

export const managePosition = async (userId, chatId, positionPDA) => {

    console.log(`User: ${userId} wants to us to manage position: ${positionPDA}.`);

    const { rows: userRows } = await pool.query('SELECT pubkey FROM users where telegram_user_id = $1;', [userId]);

    if(userRows.length === 0) {

        return "You do not have a wallet yet, please create a wallet first!";
    
    }

    const { rows: positions } = await pool.query("SELECT * from user_positions_history WHERE position_pda = $1 AND position_pda NOT IN (SELECT position_pda from user_positions_history WHERE position_pda = $1 and action_type NOT IN ('add'));", [positionPDA]);

    if(positions.length === 0) {

        return "This position either never existed or has been closed! Please try a different position";
    
    }

    const liquidityBookServices = new LiquidityBookServices({
        
            mode: MODE.DEVNET,
            
            options: {
            
                rpcUrl: "https://api.devnet.solana.com",
            
                commitmentOrConfig: "confirmed"
            }
            
    });

    const pair = positions[0].pair;

    const position_nft = positions[0].position_nft;

    const bin_array_lower = positions[0].bin_array_lower;

    const bin_array_upper = positions[0].bin_array_upper;

    const min_bin = Number(positions[0].min_bin);

    const max_bin = Number(positions[0].max_bin);

    const base_token = positions[0].base_token;

    const quote_token = positions[0].quote_token;

    const base_amount = Number(positions[0].base_amount);

    const quote_amount = Number(positions[0].quote_amount);

    const liquidity_distribution = positions[0].liquidity_distribution;

    const poolInfo = await liquidityBookServices.getPairAccount(new PublicKey(pair));

    const activeBin = poolInfo.activeId;

    const currentSlot = await connection.getSlot();

    await pool.query(
        
        `INSERT INTO manage_user_positions (user_id, chat_id, pair, position_nft, position_pda, last_active_bin, bin_array_lower, bin_array_upper, min_bin, max_bin, base_token, quote_token, base_amount, quote_amount, last_slot, liquidity_distribution) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);`,
        
        [userId, chatId, pair, position_nft, positionPDA, activeBin, bin_array_lower, bin_array_upper, min_bin, max_bin, base_token, quote_token, base_amount, quote_amount, currentSlot, JSON.stringify(liquidity_distribution)]
    
    );

    return `Saros DLLM bot will manage this position for you automatically.\nThe current active bin is: ${activeBin}\nCurrent slot is: ${currentSlot}`;

}
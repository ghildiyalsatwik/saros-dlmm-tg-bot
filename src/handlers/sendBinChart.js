import { fetchActiveBinArrayInfo } from "../utils/fetchActiveBinArrayInfo.js";
import { generateBinChart } from "../utils/chart.js";
import bot from "../utils/bot.js";

export const sendBinChart = async (userId, chatId, pair) => {

    console.log(`User: ${userId} wants to view the chart for pool: ${pair}`);

    const bins = await fetchActiveBinArrayInfo(pair);
  
    const buffer = await generateBinChart(bins);

    await bot.sendPhoto(chatId, buffer, {
        
        caption: `Here's the liquidity distribution around the active bin for pool ${pair}`
    
    });
};
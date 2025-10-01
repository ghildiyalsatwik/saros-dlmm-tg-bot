import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { startHandler } from "./handlers/start.js";
import { handleError } from "./handlers/error.js";
import { handleDefault } from "./handlers/default.js";
import { createWallet } from "./handlers/createWallet.js";
import { getSOLBalance } from "./handlers/SOLBalance.js";
import axios from "axios";
import fetch from "node-fetch";
import { mintToken } from "./handlers/mintToken.js";
import { createPool } from "./handlers/createPool.js";
import { addLiquidity } from "./handlers/addLiquidity.js";
import { swap } from "./handlers/swap.js";
import { removeLiquidity } from "./handlers/removeLiquidity.js";
import { handleEject } from "./handlers/handleEject.js";
import { subscribe } from "./handlers/subscribe.js";
import { sendBinChart } from "./handlers/sendBinChart.js"; 

const app = express();

app.use(express.json());

const PORT = process.env.MAIN_SERVER_PORT;

const BOT_URL = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;

app.listen(PORT, () => {

    console.log(`Main server is running at PORT: ${PORT}`);

});

app.post('/webhook', async (req, res) => {

    const msg = req.body.message;

    const userId = msg.from.id;

    const userMessage = msg.text;

    const chatId = msg.chat.id;

    console.log(userId, userMessage);


    if(userMessage === '/start') {

        const reply = startHandler(userId);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    }

    const systemPrompt = process.env.SYSTEM_PROMPT.replace(/\\n/g, "\n");

    const finalPrompt = `###System: ${systemPrompt} ###User : ${userMessage}`;

    const inferenceUrl = process.env.INFERENCE_URL;

    const model = process.env.MODEL;

    const llmResp = await fetch(inferenceUrl, {
        
        method: 'POST',
        
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          
            model: model,
          
            prompt: finalPrompt,
          
            stream: false
        
        })
    
    });

    const json = await llmResp.json();

    const llmOutput = json.response.trim();

    let intent;

    try {

        intent = JSON.parse(llmOutput);
    
    } catch(e) {

        console.log('Could not parse the LLM response as a JSON object.');

        const reply = handleError();

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    }

    if(intent.command === 'create_wallet') {

        const reply = await createWallet(userId);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'get_balance' && intent.token === '') {

        console.log('The user did not specify the token whose balance they wanted to check.');

        await axios.post(BOT_URL, { chat_id: chatId, text: 'Please specify the token whose balance you want to check.' });

        return res.sendStatus(200);


    } else if(intent.command === 'get_balance' && intent.token === 'SOL') {

        const reply = await getSOLBalance(userId);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'mint_token') {

        const reply = await mintToken(userId, intent.name, intent.symbol, intent.decimals, intent.initial_amount);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'create_pool') {

        const reply = await createPool(userId, intent.base_token, intent.quote_token, intent.bin_step, intent.rate_price);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'add_liquidity') {

        const reply = await addLiquidity(userId, intent.pair, intent.shape, intent.base_amount, intent.quote_amount, intent.min_bin, intent.max_bin);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'swap') {

        const reply = await swap(userId, intent.from, intent.to, intent.amount);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'remove_liquidity') {

        const reply = await removeLiquidity(userId, intent.position_pda);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'eject') {

        const reply = await handleEject(userId);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'subscribe') {

        const reply = await subscribe(userId, intent.pair, chatId);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);

    } else if(intent.command === 'chart_liquidity') {

        if(intent.pair === '') {

            await axios.post(BOT_URL, { chat_id: chatId, text: 'Please specify the pool whose chart you want to view.' });

            return res.sendStatus(200);

        }

        await sendBinChart(userId, chatId, intent.pair);

        return res.sendStatus(200);

    } else {

        const reply = handleDefault(userId);

        await axios.post(BOT_URL, { chat_id: chatId, text: reply });

        return res.sendStatus(200);
    }

});
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const fetchActiveBinArrayInfo = async (pairAddress, range = 20) => {

    const pair = new PublicKey(pairAddress);

    const liquidityBookServices = new LiquidityBookServices({
    
        mode: MODE.DEVNET,
    
        options: {
    
            rpcUrl: "https://api.devnet.solana.com",
    
            commitmentOrConfig: "confirmed"
        }
    
    });
    
    const pairInfo = await liquidityBookServices.getPairAccount(pair);

    const activeBin = pairInfo.activeId;

    const globalStart = activeBin - range;
    
    const globalEnd = activeBin + range;

    const startArrayIndex = Math.floor(globalStart / 256);
    
    const endArrayIndex = Math.floor(globalEnd / 256);


    let binsWithIndices = [];


    for(let arrIndex = startArrayIndex; arrIndex <= endArrayIndex; arrIndex++) {
        
        try {
            
            const binArrayInfo = await liquidityBookServices.getBinArrayInfo({
                
                binArrayIndex: arrIndex,
                
                pair,
                
                payer: pair
            
            });
        
            binArrayInfo.bins.forEach((bin, localIndex) => {
            
                const globalIndex = arrIndex * 256 + localIndex;
                
                if(globalIndex >= globalStart && globalIndex <= globalEnd) {

                    const reserveX = new BN(bin.reserveX.toString());
                    
                    const reserveY = new BN(bin.reserveY.toString());
                    
                        binsWithIndices.push({
                        
                            globalIndex,
                        
                            reserveX: new BN(bin.reserveX.toString()),
                        
                            reserveY: new BN(bin.reserveY.toString()),
                        
                            totalSupply: new BN(bin.totalSupply.toString())
                    
                        });
                }
        
            });

        } catch(err) {

            continue;
        }
    }

    console.log(binsWithIndices);

    return binsWithIndices;
}
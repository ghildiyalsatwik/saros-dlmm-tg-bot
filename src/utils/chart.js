import { ChartJSNodeCanvas } from "chartjs-node-canvas";

const width = 800;

const height = 400;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

export const generateBinChart = async (bins) => {
    
    const labels = bins.map((_, i) => i - (bins.length / 2));

    const reservesX = bins.map(b => Number(b.reserveX) || 0);
    
    const reservesY = bins.map(b => Number(b.reserveY) || 0);
  
    const config = {
      
        type: "bar",
      
        data: {
      
            labels,
      
            datasets: [
      
                {
      
                    label: "Reserve X",
      
                    data: reservesX,
      
                    backgroundColor: "rgba(54, 162, 235, 0.5)"
      
                },
      
                {
      
                    label: "Reserve Y",
      
                    data: reservesY,
      
                    backgroundColor: "rgba(255, 99, 132, 0.5)"
      
                }
      
            ]
      
        },
      
        options: {
      
            plugins: {
      
                title: {
      
                    display: true,
      
                    text: `Liquidity distribution around the active bin`
      
                }
      
            },
      
            scales: {
      
                x: { title: { display: true, text: "Bin offset" } },
      
                y: { title: { display: true, text: "Reserves" } }
      
            }
      
        }
    };
    
    return await chartJSNodeCanvas.renderToBuffer(config);

};


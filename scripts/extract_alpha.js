import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

async function processAlpha(whitePath, blackPath, outPath) {
    const whiteImg = await loadImage(whitePath);
    const blackImg = await loadImage(blackPath);
    
    const width = whiteImg.width;
    const height = whiteImg.height;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(whiteImg, 0, 0);
    const whiteData = ctx.getImageData(0, 0, width, height).data;
    
    ctx.drawImage(blackImg, 0, 0);
    const blackData = ctx.getImageData(0, 0, width, height).data;
    
    const outData = ctx.createImageData(width, height);
    
    for (let i = 0; i < whiteData.length; i += 4) {
        const rw = whiteData[i];
        const gw = whiteData[i+1];
        const bw = whiteData[i+2];
        
        const rb = blackData[i];
        const gb = blackData[i+1];
        const bb = blackData[i+2];
        
        // Use green channel for alpha calculation as it's usually the most perceptive
        // alpha = 1 - (W - B)/255
        // We average the three channels to be safe
        let alpha = 1 - ((rw - rb) + (gw - gb) + (bw - bb)) / (3 * 255);
        alpha = Math.max(0, Math.min(1, alpha));
        
        outData.data[i+3] = Math.round(alpha * 255);
        
        if (alpha > 0.01) {
            outData.data[i] = Math.min(255, Math.max(0, Math.round(rb / alpha)));
            outData.data[i+1] = Math.min(255, Math.max(0, Math.round(gb / alpha)));
            outData.data[i+2] = Math.min(255, Math.max(0, Math.round(bb / alpha)));
        } else {
            outData.data[i] = 0;
            outData.data[i+1] = 0;
            outData.data[i+2] = 0;
        }
    }
    
    ctx.putImageData(outData, 0, 0);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved ${outPath}`);
}

const args = process.argv.slice(2);
if (args.length !== 3) {
    console.error("Usage: node extract_alpha.js <white_bg> <black_bg> <out>");
    process.exit(1);
}

processAlpha(args[0], args[1], args[2]).catch(console.error);

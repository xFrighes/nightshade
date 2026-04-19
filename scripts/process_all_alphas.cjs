const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

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
        const rw = whiteData[i], gw = whiteData[i+1], bw = whiteData[i+2];
        const rb = blackData[i], gb = blackData[i+1], bb = blackData[i+2];
        
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
    console.log(`Saved transparent image: ${outPath}`);
}

async function run() {
    const dir = path.join(__dirname, '..', 'public', 'story-assets');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const files = fs.readdirSync(dir);
    const whiteFiles = files.filter(f => f.endsWith('_white.png'));
    
    for (const whiteFile of whiteFiles) {
        const base = whiteFile.replace('_white.png', '');
        const blackFile = `${base}_black.png`;
        const outFile = `${base}.png`;
        
        if (files.includes(blackFile)) {
            console.log(`Processing ${base}...`);
            await processAlpha(
                path.join(dir, whiteFile),
                path.join(dir, blackFile),
                path.join(dir, outFile)
            );
        } else {
            console.log(`Skipping ${base}: matching black file not found.`);
        }
    }
    console.log("Done extracting alpha for all images!");
}

run().catch(console.error);

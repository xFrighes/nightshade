const { execSync } = require('child_process');

// Get image dimensions
const dims = execSync('identify -format "%w %h" public/UI.png').toString().split(' ').map(Number);
const width = dims[0];
const height = dims[1];

console.log(`Image: ${width}x${height}`);

// Sample 50x50 points
const grid = 50;
let minX = grid, maxX = 0, minY = grid, maxY = 0;
let foundAny = false;

for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
        const px = Math.floor((x / grid) * width);
        const py = Math.floor((y / grid) * height);
        
        // Get alpha of this pixel
        const alpha = execSync(`magick public/UI.png -format "%[pixel:p{${px},${py}}]\n" info:`).toString();
        // srgba(41,26,20,1) or srgba(0,0,0,0)
        const match = alpha.match(/rgba\(\d+,\d+,\d+,([\d.]+)\)/);
        if (match) {
            const a = parseFloat(match[1]);
            if (a < 0.1) {
                foundAny = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
}

if (!foundAny) {
    console.log("No transparent pixels found in 50x50 sample.");
} else {
    console.log(`Transparent area (50x50 scale): X: ${minX}-${maxX}, Y: ${minY}-${maxY}`);
    console.log(`Top: ${minY * 2}%`);
    console.log(`Bottom: ${100 - (maxY * 2)}%`);
    console.log(`Left: ${minX * 2}%`);
    console.log(`Right: ${100 - (maxX * 2)}%`);
}

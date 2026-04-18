const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function processImages() {
  const imgW = await loadImage('public/settings-assets-w.png');
  const imgB = await loadImage('public/settings-assets-b.png');

  const width = imgW.width;
  const height = imgW.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(imgW, 0, 0);
  const dataW = ctx.getImageData(0, 0, width, height).data;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(imgB, 0, 0);
  const dataB = ctx.getImageData(0, 0, width, height).data;

  const outCanvas = createCanvas(width, height);
  const outCtx = outCanvas.getContext('2d');
  const outData = outCtx.createImageData(width, height);

  for (let i = 0; i < dataW.length; i += 4) {
    const rw = dataW[i], gw = dataW[i + 1], bw = dataW[i + 2];
    const rb = dataB[i], gb = dataB[i + 1], bb = dataB[i + 2];

    // Alpha = 1 - (White - Black)
    // Assuming grayscale/equal-channel diff for simplicity or just pick one channel
    const alpha = 255 - (rw - rb);

    if (alpha === 0) {
      outData.data[i] = 0;
      outData.data[i + 1] = 0;
      outData.data[i + 2] = 0;
      outData.data[i + 3] = 0;
    } else {
      // Color = Black / Alpha
      outData.data[i] = Math.round((rb * 255) / alpha);
      outData.data[i + 1] = Math.round((gb * 255) / alpha);
      outData.data[i + 2] = Math.round((bb * 255) / alpha);
      outData.data[i + 3] = alpha;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  const buffer = outCanvas.toBuffer('image/png');
  fs.writeFileSync('public/settings-assets.png', buffer);
  console.log('Saved public/settings-assets.png');
}

processImages().catch(console.error);

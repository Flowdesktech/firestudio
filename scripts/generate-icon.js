const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
let pngToIco;
try {
  const pngToIcoModule = require('png-to-ico');
  // Use default export or imagesToIco
  pngToIco = pngToIcoModule.default || pngToIcoModule.imagesToIco || pngToIcoModule;
} catch (e) {
  console.log('png-to-ico not installed, ICO generation will be skipped');
}

// Create a simple Firestudio icon: Orange flame on dark background with "FS" text
async function generateIcon() {
  const size = 512;

  // Create SVG with flame design
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" style="stop-color:#ff6b00"/>
      <stop offset="50%" style="stop-color:#ff9500"/>
      <stop offset="100%" style="stop-color:#ffcc00"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="100" fill="url(#bgGrad)"/>
  
  <!-- Flame icon -->
  <g transform="translate(256, 220)">
    <path d="M0-140 c-25,50-65,85-65,130 c0,55,40,95,65,95 c-15,-25-25,-50-25,-75 c0,-40,40,-70,40,-100 c25,40,50,65,50,105 c0,25,-10,50,-25,75 c25,0,65,-40,65,-95 c0,-50,-40,-80,-65,-130 c-15,30,-40,50,-40,80 c0,-50,-25,-65,-25,-85z" 
          fill="url(#fireGrad)" 
          stroke="#ff9500" 
          stroke-width="2"/>
  </g>
  
  <!-- FS Text -->
  <text x="256" y="420" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="100" font-weight="bold">FS</text>
  
  <!-- Subtitle -->
  <text x="256" y="465" text-anchor="middle" fill="#888" font-family="Arial, sans-serif" font-size="32">studio</text>
</svg>
`;

  const assetsDir = path.join(__dirname, '../assets');

  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Generate PNG icons in different sizes
  const sizes = [16, 32, 64, 128, 256, 512];

  for (const s of sizes) {
    await sharp(Buffer.from(svg))
      .resize(s, s)
      .png()
      .toFile(path.join(assetsDir, `icon-${s}.png`));
    console.log(`Generated icon-${s}.png`);
  }

  // Generate main icon.png (256x256 is good for Electron)
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('Generated icon.png (256x256)');

  // Also save the SVG
  fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svg.trim());
  console.log('Generated icon.svg');

  // Generate ICO file for Windows (using multiple sizes)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoPngs = [];

  for (const s of icoSizes) {
    const pngPath = path.join(assetsDir, `icon-${s}.png`);
    if (fs.existsSync(pngPath)) {
      icoPngs.push(pngPath);
    } else {
      // Generate if not exists
      await sharp(Buffer.from(svg))
        .resize(s, s)
        .png()
        .toFile(pngPath);
      icoPngs.push(pngPath);
    }
  }

  try {
    const icoBuffer = await pngToIco(icoPngs);
    fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);
    console.log('Generated icon.ico');
  } catch (err) {
    console.error('Failed to generate ICO:', err.message);
  }

  console.log('\nIcon generation complete!');
}

generateIcon().catch(console.error);

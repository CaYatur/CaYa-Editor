const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

async function buildIco() {
  const svgPath = path.join(__dirname, '..', 'assets', 'CYEditorLogo.svg');
  const outIco = path.join(__dirname, '..', 'assets', 'CYEditorLogo.ico');
  if (!fs.existsSync(svgPath)) {
    console.error('SVG source not found:', svgPath);
    process.exit(1);
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(svgPath)
      .resize(size, size, { fit: 'contain' })
      .png()
      .toBuffer();
    pngBuffers.push(buf);
  }

  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(outIco, icoBuffer);
  console.log('Wrote:', outIco);
}

buildIco().catch((err) => {
  console.error(err);
  process.exit(1);
});

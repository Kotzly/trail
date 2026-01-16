import sharp from 'sharp';
import fs from 'fs';

async function generateIcons() {
  const sizes = [16, 32, 48, 128];

  fs.mkdirSync('public/icons', { recursive: true });

  await Promise.all(sizes.map(async (size) => {
    const icon = await sharp('public/icons/trail.svg')
      .resize(size, size)
      .toFormat('png')
      .toFile(`public/icons/trail-${size}.png`);
  }));

  console.log('Icons generated successfully');
}

generateIcons().catch(console.error);
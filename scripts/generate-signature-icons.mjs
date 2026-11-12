import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/signature', { recursive: true });
const icons = {
 brand: '<path d="M2 15 10 5v6l7-7v7l5-5v9l-6 5v-7l-7 7v-7l-7 7z" fill="currentColor" stroke="none"/>',

 web: '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.5" ry="8"/><path d="M4 12h16M6 7.5h12M6 16.5h12"/>',
 instagram: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r=".8" fill="currentColor" stroke="none"/>',
 linkedin: '<circle cx="5" cy="5" r="1.8" fill="currentColor" stroke="none"/><path d="M5 10v9M10 19v-9M10 13c0-5 8-5 8 0v6" stroke-width="3"/>',
 youtube: '<rect x="3" y="6" width="18" height="12" rx="4" fill="currentColor" stroke="none"/><path d="m10 9 5 3-5 3z" fill="white" stroke="none"/>',
 x: '<path d="m5 4 14 16h-4L1 4h4ZM3 20 19 4"/>',
};
for (const [name, paths] of Object.entries(icons)) {
 for (const light of [false,true]) {
  const color = light ? '#e3d8ec' : '#51405d';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${color}" color="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/signature/${name}${light ? '-light' : ''}.png`);
 }
}

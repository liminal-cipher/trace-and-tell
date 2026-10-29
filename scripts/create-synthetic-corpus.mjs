import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const directory = new URL("../tests/fixtures/model/inputs/", import.meta.url);
await mkdir(directory, { recursive: true });
// Original, fictional graphics made for this repository. No photographs,
// people, EXIF, filenames or captions supply hidden evaluation answers.
const samples = [
  ["01", "ORBIT 47", "ADMIT ONE", "BLUE TICKET", 0],
  ["02", "ORBIT 47", "COLLECTION NOTE", "BLUE TICKET", 0],
  ["03", "CEDAR 82", "GARDEN PASS", "GREEN BENCH", 0],
  ["04", "????????", "UNREADABLE", "", 30],
  ["05", "ORBIT 47", "ENTRY LOG", "OPEN: 12 JUNE", 0],
  ["06", "ORBIT 47", "ENTRY LOG", "CLOSED: 12 JUNE", 0],
];
for (const [id, title, line, detail, blur] of samples) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#ded6c4"/><rect x="44" y="60" width="552" height="350" rx="6" fill="#345e68"/><rect x="68" y="84" width="504" height="302" fill="none" stroke="#e6d7aa" stroke-width="2"/><text x="320" y="175" text-anchor="middle" font-family="Arial" font-size="48" fill="#f9edcf">${title}</text><path d="M100 210H540" stroke="#e6d7aa"/><text x="320" y="265" text-anchor="middle" font-family="Arial" font-size="26" fill="#f9edcf">${line}</text><text x="320" y="330" text-anchor="middle" font-family="Arial" font-size="26" fill="#f9edcf">${detail}</text></svg>`;
  let image=sharp(Buffer.from(svg)); if(blur)image=image.blur(blur);
  await writeFile(new URL(`${id}.png`,directory),await image.png().toBuffer());
}
console.log("Created six synthetic PNG inputs without metadata.");

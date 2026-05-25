import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
const MODEL_FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin'
];

const TARGET_DIR = path.join(__dirname, '..', 'public', 'models');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function downloadFile(url, targetPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${path.basename(targetPath)}...`);
    const file = fs.createWriteStream(targetPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded ${path.basename(targetPath)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(targetPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading face-api.js models...');
  for (const file of MODEL_FILES) {
    const url = `${MODELS_URL}${file}`;
    const targetPath = path.join(TARGET_DIR, file);
    try {
      await downloadFile(url, targetPath);
    } catch (err) {
      console.error(err);
    }
  }
  console.log('Finished downloading all models.');
}

main();

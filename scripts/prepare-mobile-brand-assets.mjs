import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const channel = process.env.WAITERO_MOBILE_CHANNEL === 'dev' ? 'dev' : 'prod';
const sourceFile = channel === 'dev'
  ? resolve('..', 'Assets', 'Logo Bianco - Bordato.png')
  : resolve('..', 'Assets', 'Logo Nero.png');
const targetFile = resolve('resources', 'icon.png');

if (!existsSync(sourceFile)) {
  console.error(`Mobile brand asset not found: ${sourceFile}`);
  process.exit(1);
}

copyFileSync(sourceFile, targetFile);
console.log(`Prepared mobile icon for ${channel}: ${sourceFile}`);

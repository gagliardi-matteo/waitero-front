import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pluginGradlePath = resolve('node_modules/@capgo/capacitor-social-login/android/build.gradle');
const source = readFileSync(pluginGradlePath, 'utf8');
const patched = source.replaceAll('androidx.browser:browser:1.9.0', 'androidx.browser:browser:1.4.0');

if (patched !== source) {
  writeFileSync(pluginGradlePath, patched, 'utf8');
  console.log('Patched @capgo/capacitor-social-login Android browser dependency to 1.4.0');
} else {
  console.log('@capgo/capacitor-social-login Android browser dependency already patched');
}

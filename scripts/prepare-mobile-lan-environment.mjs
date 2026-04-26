import { networkInterfaces } from 'node:os';
import { writeFileSync } from 'node:fs';

const outputPath = new URL('../src/environments/environment.mobile.ts', import.meta.url);

function firstLanIp() {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue;
      }

      if (entry.address.startsWith('169.254.')) {
        continue;
      }

      return entry.address;
    }
  }

  return null;
}

const explicitApiUrl = process.env.WAITERO_LAN_API_URL?.trim();
const explicitIp = process.env.WAITERO_LAN_IP?.trim();
const detectedIp = explicitIp || firstLanIp();

if (!explicitApiUrl && !detectedIp) {
  console.error('Unable to determine a LAN API URL. Set WAITERO_LAN_API_URL or WAITERO_LAN_IP.');
  process.exit(1);
}

const apiUrl = explicitApiUrl || `http://${detectedIp}:8080/api`;

const content = `export const environment = {
  production: false,
  apiUrl: '${apiUrl}',
  googleMapsApiKey: ''
};
`;

writeFileSync(outputPath, content, 'utf8');
console.log(`Mobile LAN API URL set to ${apiUrl}`);

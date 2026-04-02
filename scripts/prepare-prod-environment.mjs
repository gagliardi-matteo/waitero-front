import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputPath = resolve('src/environments/environment.prod.generated.ts');
const apiUrl = process.env.WAITERO_API_URL?.trim() || 'https://waitero-back-production-f19d.up.railway.app/api';
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || '';

const fileContent = `export const environment = {
  production: true,
  apiUrl: '${escapeForTs(apiUrl)}',
  googleMapsApiKey: '${escapeForTs(googleMapsApiKey)}'
};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, fileContent, 'utf8');

function escapeForTs(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

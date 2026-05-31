import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputPath = resolve('src/environments/environment.prod.generated.ts');
const apiUrl = process.env.WAITERO_API_URL?.trim() || 'https://waitero-back.onrender.com/api';
const publicFrontendUrl = process.env.WAITERO_PUBLIC_FRONTEND_URL?.trim() || 'https://waitero.front.vercel.app';
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
const googleAuthServerClientId = process.env.GOOGLE_AUTH_SERVER_CLIENT_ID?.trim() || '910347869788-astuldpi4hi3hb0osucuoclhfjdh5dtj.apps.googleusercontent.com';

const fileContent = `export const environment = {
  production: true,
  apiUrl: '${escapeForTs(apiUrl)}',
  publicFrontendUrl: '${escapeForTs(publicFrontendUrl)}',
  googleMapsApiKey: '${escapeForTs(googleMapsApiKey)}',
  googleAuth: {
    serverClientId: '${escapeForTs(googleAuthServerClientId)}'
  },
  privacy: {
    customerBrowserFingerprintEnabled: false
  }
};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, fileContent, 'utf8');

function escapeForTs(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

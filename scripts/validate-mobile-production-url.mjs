const defaultApiUrl = 'https://waitero-back.onrender.com/api';
const rawApiUrl = process.env.WAITERO_API_URL?.trim() || defaultApiUrl;

let parsedUrl;
try {
  parsedUrl = new URL(rawApiUrl);
} catch {
  console.error(`WAITERO_API_URL is not a valid URL: ${rawApiUrl}`);
  process.exit(1);
}

if (parsedUrl.protocol !== 'https:') {
  console.error(`Production mobile builds require HTTPS. Received: ${rawApiUrl}`);
  process.exit(1);
}

if (isLocalHost(parsedUrl.hostname) || isPrivateIpv4(parsedUrl.hostname)) {
  console.error(`Production mobile builds cannot point to localhost or a private LAN IP. Received: ${rawApiUrl}`);
  process.exit(1);
}

console.log(`Validated production mobile API URL: ${rawApiUrl}`);

function isLocalHost(hostname) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isPrivateIpv4(hostname) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return false;
  }

  const [a, b] = hostname.split('.').map(Number);
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

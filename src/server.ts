import 'zone.js/node';
import express from 'express';
import { join } from 'path';
import { readFileSync } from 'fs';

const app = express();
const port = process.env['PORT'] || 3000;

const distFolder = join(process.cwd(), 'dist/client');
const indexHtml = readFileSync(join(distFolder, 'index.html'), 'utf-8');

app.use(express.static(distFolder));

app.get('*', async (req, res) => {
  try {
    // @ts-ignore
    const { render } = await import('./dist/server/main.server.js'); // ✅ CORRETTO
    const html = await render({ document: indexHtml, url: req.url });
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.listen(port, () => {
  console.log(`✅ Angular SSR server listening on http://localhost:${port}`);
});

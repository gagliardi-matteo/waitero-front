import 'zone.js/node';
import express from 'express';
import { join } from 'path';
import { readFileSync } from 'fs';
import { renderApplication } from '@angular/platform-server';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { bootstrapApplication } from '@angular/platform-browser';

const app = express();
const port = process.env['PORT'] || 3000;
const distFolder = join(process.cwd(), 'dist/client');
const indexHtml = readFileSync(join(distFolder, 'index.html'), 'utf-8');

app.use(express.static(distFolder));

app.get('*', async (req, res) => {
  try {
    const html = await renderApplication(() => bootstrapApplication(AppComponent, config), {
      document: indexHtml,
      url: req.url
    });
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore nel rendering SSR');
  }
});

app.listen(port, () => {
  console.log(`✅ SSR in ascolto su http://localhost:${port}`);
});

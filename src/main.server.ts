import 'zone.js/node';
import { renderApplication } from '@angular/platform-server';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { bootstrapApplication } from '@angular/platform-browser';
import { readFileSync } from 'fs';
import { join } from 'path';

export default (url: string) => {
  const document = readFileSync(join(process.cwd(), 'dist/client/index.html'), 'utf-8');

  return renderApplication(() => bootstrapApplication(AppComponent, config), {
    document,
    url,
  });
};

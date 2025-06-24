import 'zone.js/node';
import { renderApplication } from '@angular/platform-server';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { bootstrapApplication } from '@angular/platform-browser';

export function render(opts: { document: string; url: string }) {
  return renderApplication(() => bootstrapApplication(AppComponent, config), {
    document: opts.document,
    url: opts.url,
  });
}

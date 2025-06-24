import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
export { AppServerModule } from './app/app.server.module';

const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;

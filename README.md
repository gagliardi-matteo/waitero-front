# Front

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.12.

## Development server

Per i test locali usa il backend su `http://localhost:8080` tramite proxy Angular:

```bash
npm run dev
```

oppure:

```bash
npm run start:local
```

Apri poi `http://localhost:4200/`.

## Local backend target

In sviluppo il frontend usa `proxy.conf.json`, quindi tutte le chiamate `/api/*` vengono inoltrate al backend locale su `http://localhost:8080`.

Prima di testare assicurati che il backend WaiterO sia attivo in locale.

## Build

```bash
npm run build
```

La build production usa `environment.prod.ts` e punta al backend production.

## Running unit tests

```bash
ng test
```

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

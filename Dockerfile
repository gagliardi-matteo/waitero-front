FROM node:20 AS build

WORKDIR /app

# Installa le dipendenze
COPY package*.json ./
RUN npm install

# Copia tutto il codice (incluso src/index.html!)
COPY . .

# Costruisci l'app partendo da /app, Vite userà /app/src come root
RUN npm run build

# Secondo stage: usa Nginx per servire l'app
FROM nginx:alpine

# Copia i file buildati da vite
COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Etapa 1: build dell'app Angular
FROM node:20 AS build

WORKDIR /app

# Copia i file di configurazione e installa le dipendenze
COPY package*.json ./
RUN npm install

# Copia il resto del codice e builda l'app Angular
COPY . .
RUN npm run build -- --output-path=dist

# Etapa 2: server Nginx per servire i file statici
FROM nginx:alpine

# Copia i file di build Angular nel path statico Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia una configurazione base di Nginx (facoltativa)
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

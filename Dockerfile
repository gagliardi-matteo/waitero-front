FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# DEBUG: stampa contenuto della cartella
RUN ls -R /app

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/client /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

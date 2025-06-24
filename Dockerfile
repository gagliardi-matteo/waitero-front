FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Spostati esplicitamente nella directory src prima del build
WORKDIR /app/src
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/client /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM node:20.3.0-alpine AS build
WORKDIR /app
COPY package*.json ./

RUN npm install
COPY . .
RUN npm run build

FROM node:20.3.0-alpine
WORKDIR /app
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev

ENV PORT=3000
ENV UDP_PORT=5000

EXPOSE 3000
EXPOSE 5000/udp

CMD ["npm", "run", "start:prod"]

FROM node:20-alpine

# better-sqlite3 needs native build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json .
RUN npm install
COPY . .

CMD ["node", "index.js"]

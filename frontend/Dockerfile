FROM node:20-alpine AS base

WORKDIR /app

# Dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Source
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Base Node environment
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Install dependencies
FROM base AS dependencies
RUN npm ci --only=production
COPY . .

# Release image
FROM node:18-alpine AS release
WORKDIR /app
COPY --from=dependencies /app ./
EXPOSE 5000
CMD ["npm", "start"]

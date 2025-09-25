# Use lightweight Node.js image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies (only production deps)
COPY package*.json ./
RUN npm install --omit=dev

# Bundle app source
COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]

FROM node:20-slim

# Install poppler-utils for PDF image extraction
RUN apt-get update && apt-get install -y \
    poppler-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --production

# Install client dependencies and build
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Copy server source
COPY server/ ./server/

# Create storage directory
RUN mkdir -p /app/storage

ENV NODE_ENV=production
ENV STORAGE_PATH=/app/storage
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/src/index.js"]

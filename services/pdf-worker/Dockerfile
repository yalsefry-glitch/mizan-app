FROM node:20-slim

# Install system dependencies for PDF processing
RUN apt-get update && \
    apt-get install -y \
    ghostscript \
    graphicsmagick \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

EXPOSE 10000

CMD ["node", "index.js"]

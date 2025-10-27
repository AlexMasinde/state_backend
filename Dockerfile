# ---- Stage 1: build NestJS app ----
    FROM node:20-slim AS build

    WORKDIR /app
    
    # Install build deps (for any native modules compiled during npm ci)
    RUN apt-get update && apt-get install -y \
        build-essential \
        && rm -rf /var/lib/apt/lists/*
    
    # Copy Node manifests and install deps
    COPY package*.json ./
    RUN npm ci
    
    # Copy full source and build
    COPY . .
    RUN npm run build
    
    
    # ---- Stage 2: runtime image ----
    FROM node:20-slim AS runtime
    
    WORKDIR /app
    
    # Install Chromium + system libs required for headless PDF rendering
    RUN apt-get update && apt-get install -y \
        chromium \
        chromium-common \
        chromium-sandbox \
        fonts-liberation \
        libatk-bridge2.0-0 \
        libasound2 \
        libatk1.0-0 \
        libcups2 \
        libdrm2 \
        libgbm1 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        xdg-utils \
        --no-install-recommends && \
        rm -rf /var/lib/apt/lists/*
    
    # Copy runtime build artifacts
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/dist ./dist
    COPY --from=build /app/package*.json ./
    
    # Environment vars baked into the container
    ENV NODE_ENV=production
    ENV PORT=3000
    
    # Puppeteer runtime config
    ENV PUPPETEER_SKIP_DOWNLOAD=true
    ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
    
    EXPOSE 3000
    
    # Your package.json scripts:
    # "build": "nest build"
    # "start:prod": "node dist/main"
    # We want to run the compiled app, not ts-node.
    CMD ["npm", "run", "start:prod"]
    
# Use Node.js latest stable version
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy plugin files
COPY . .

# Create homebridge config directory
RUN mkdir -p ~/.homebridge

# Expose Homebridge port
EXPOSE 51826

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:51826/ || exit 1

# Generate config from environment and start Homebridge
CMD ["sh", "-c", "node setup.js && homebridge -I -U ~/.homebridge"]

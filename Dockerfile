# Use Node.js latest stable version
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    avahi-compat-libdns_sd \
    avahi-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy plugin files
COPY . .

# Create homebridge user and directories
RUN addgroup -g 1000 homebridge && \
    adduser -u 1000 -G homebridge -s /bin/sh -D homebridge && \
    mkdir -p /home/homebridge/.homebridge && \
    chown -R homebridge:homebridge /home/homebridge

# Switch to homebridge user
USER homebridge

# Create default config directory
RUN mkdir -p /home/homebridge/.homebridge

# Expose Homebridge port
EXPOSE 51826

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:51826/ || exit 1

# Start Homebridge
CMD ["homebridge", "-I", "-U", "/home/homebridge/.homebridge"]

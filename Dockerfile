# Use an official Node image
FROM node:18-slim

# Install LibreOffice + dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice \
        libreoffice-writer \
        libreoffice-calc \
        libreoffice-impress \
        fonts-dejavu \
        ghostscript && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install backend dependencies
RUN npm install --production

# Copy the rest of your backend
COPY . .

# Expose the port Render expects
EXPOSE 10000

# Start your backend
CMD ["npm", "start"]

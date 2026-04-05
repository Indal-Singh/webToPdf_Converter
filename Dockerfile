# Use Ubuntu 22.04 as base image
FROM ubuntu:22.04

# Set the working directory
WORKDIR /app


# Install required OS-level dependencies for Puppeteer and XVFB
RUN apt-get update && \
    apt-get install -y \
      wget \
      ca-certificates \
      unzip \
      fontconfig \
      gnupg \
      fonts-liberation \
      libasound2 \
      libatk1.0-0 \
      libcups2 \
      libnss3 \
      libxss1 \
      xauth \
      xvfb \
      curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /usr/share/keyrings/google-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/google-archive-keyring.gpg] https://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*   
# Install Node.js & npm from Nodesource (Version 20)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Verify installation
RUN node -v && npm -v

# Keep Docker build output clean by disabling npm's update notice
RUN npm config set update-notifier false

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --legacy-peer-deps

# Copy and install custom fonts system-wide
COPY allfonts.zip /tmp/allfonts.zip
RUN rm -rf /tmp/allfonts && \
    mkdir -p /tmp/allfonts /usr/local/share/fonts/custom && \
    unzip -q /tmp/allfonts.zip -d /tmp/allfonts && \
    cd /tmp/allfonts/all_my_fonts && \
    find . -type f \( \
      -iname '*.ttf' -o \
      -iname '*.otf' -o \
      -iname '*.ttc' -o \
      -iname '*.pfa' -o \
      -iname '*.pfb' \
    \) -exec cp --parents "{}" /usr/local/share/fonts/custom/ \; && \
    fc-cache -f -v && \
    rm -rf /tmp/allfonts /tmp/allfonts.zip

# Copy the application source code
COPY . .

# Expose the port your app runs on
EXPOSE 3002

# Start the API directly; Puppeteer is already running in headless mode
CMD ["node", "index.js"]

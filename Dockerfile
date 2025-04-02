# Use Ubuntu 22.04 as base image
FROM ubuntu:22.04

# Set the working directory
WORKDIR /app


# Install required OS-level dependencies for Puppeteer and XVFB
RUN apt-get update && \
    apt-get install -y \
      wget \
      ca-certificates \
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

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --legacy-peer-deps

# Copy the application source code
COPY . .

# Expose the port your app runs on
EXPOSE 3002

# Set environment variables for Xvfb
ENV DISPLAY=:99

# Start Xvfb at runtime and then run the app
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & xvfb-run -e /tmp/xvfb-errors.log node index.js"]
# Step 1: Use a lightweight Node.js base image
FROM node:18-bullseye

# Step 2: Set the working directory
WORKDIR /app

# Step 3: Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Step 4: Install required OS-level dependencies for Puppeteer
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
      xvfb && \
    rm -rf /var/lib/apt/lists/*

# Step 5: Install Node.js dependencies
RUN npm install

# Step 6: Copy the application source code
COPY . .

# Step 7: Expose the port your app runs on
EXPOSE 3002

# Step 8: Define the command to start the app
CMD ["xvfb-run", "node", "index.js"]

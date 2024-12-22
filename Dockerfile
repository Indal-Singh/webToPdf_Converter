# Use the official Node.js image as a base
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy only the package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install dependencies and Playwright browsers
RUN npm install 
# browser Installations
RUN npx playwright install
RUN npx playwright install-deps

# Copy the rest of the application code
COPY . .

# Create the .env file with the PORT variable
RUN echo "PORT=3002" > .env

# Expose the port set in the environment variable
EXPOSE 3002

# Command to start the application
CMD ["npm", "start"]

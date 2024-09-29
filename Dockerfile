# Use the official Node.js image as the base image
FROM node:18

WORKDIR /

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . .

# Expose the application ports
EXPOSE 3000 8080

# Start the application
CMD ["npm", "start"]

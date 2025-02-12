# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install any needed packages
RUN npm install --force

# Copy the current directory contents into the container at /app
COPY . .

# Build the Next.js app with verbose logging
RUN npm run build --verbose

# Make port available to the world outside this container
EXPOSE ${FRONTEND_PORT}

# Run the Next.js app
CMD ["npm", "start", "--verbose"]

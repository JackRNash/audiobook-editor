# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Make port available to the world outside this container
EXPOSE ${BACKEND_PORT}

# Define environment variables
ENV FLASK_APP=app.py
ENV BACKEND_PORT=8089
ENV PYTHONPATH=/app

# Configure Python to run in unbuffered mode
ENV PYTHONUNBUFFERED=1

# Run app.py when the container launches
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=8089"]

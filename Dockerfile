FROM node:18-alpine

WORKDIR /app

# Install nginx and backend runtime
RUN apk add --no-cache python3 py3-pip nginx \
    && mkdir -p /run/nginx \
    && ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log

# Copy frontend package files
WORKDIR /app/frontend
COPY frontend/package.json ./

# Copy backend requirements (relative to root build context)
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install

# Install backend dependencies
WORKDIR /app
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the rest of the application code
COPY . .

# Set storage directory
ENV PROJECTS_DIR=/app/backend/data/projects
ENV PROFILE_STORAGE_DIR=/app/backend/data/profiles
ENV WORKFLOWS_DIR=/app/backend/data/workflows

# Build the React application
WORKDIR /app/frontend
RUN npm run build \
    && chmod -R 755 /app/frontend

# Copy nginx config
WORKDIR /app
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port for nginx (frontend + backend proxy)
EXPOSE 8080

# Start backend and nginx
# Backend is in /app/backend, so we run from /app
CMD ["sh", "-c", "uvicorn app:app --app-dir backend --host 0.0.0.0 --port 8001 & nginx -g 'daemon off;'"]

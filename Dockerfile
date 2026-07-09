# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# Stage 2: Build the Express Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install
COPY backend/ ./backend/
RUN npm run build --workspace=backend

# Stage 3: Runner
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --only=production --workspace=backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/frontend/dist ./public
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
CMD ["node", "backend/dist/server.js"]

FROM node:24-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
ENV VITE_DATA_MODE=api VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app/server
COPY package.json /app/package.json
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY src/config /app/src/config
COPY --from=web-build /app/dist /app/dist
RUN mkdir -p /app/private/uploads /app/private/backups && chown -R node:node /app/private
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5000 SERVE_SPA=true SPA_DIR=/app/dist UPLOAD_DIR=/app/private/uploads
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:5000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]

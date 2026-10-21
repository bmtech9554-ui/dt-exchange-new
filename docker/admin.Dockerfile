FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/
COPY admin/package.json admin/
RUN npm ci --ignore-scripts
COPY admin admin
RUN npm run build --workspace @dt/admin
FROM node:24.19.0-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/admin/.next/standalone ./
COPY --from=build --chown=node:node /app/admin/.next/static ./admin/.next/static
COPY --from=build --chown=node:node /app/admin/public ./admin/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/dashboard').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","admin/server.js"]

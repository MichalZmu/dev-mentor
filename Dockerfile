FROM node:26.13.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global npm@11.20.0
COPY package.json package-lock.json .npmrc ./
COPY packages/app/package.json packages/app/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:26.13.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN npm install --global npm@11.20.0
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/.npmrc ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/tsconfig.base.json ./tsconfig.base.json
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/risk-engine/package.json packages/risk-engine/package.json

RUN npm ci

COPY prisma prisma
COPY prisma7.config.ts ./
COPY generated generated
COPY packages/risk-engine packages/risk-engine
COPY apps/api apps/api

RUN npx prisma generate
RUN npm run build --workspace=@vanguard/risk-engine
RUN npm run build --workspace=@vanguard/api


FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/generated ./generated
COPY --from=build /app/packages/risk-engine/package.json ./packages/risk-engine/package.json
COPY --from=build /app/packages/risk-engine/dist ./packages/risk-engine/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/server.js"]

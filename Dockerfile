# syntax=docker/dockerfile:1
# Multi-arch-friendly image for the full TTS-b app (UI + /api/tts).
# Models are downloaded and baked into the image at build time.

FROM node:20-slim AS build
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci
COPY app ./app
COPY lib ./lib
COPY scripts ./scripts
COPY next.config.js next-env.d.ts tsconfig.json ./
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7860
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/models ./models
COPY --from=build /app/app ./app
COPY --from=build /app/lib ./lib
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/next-env.d.ts ./next-env.d.ts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
EXPOSE 7860
CMD ["npm", "start"]
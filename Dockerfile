FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lockb ./
RUN \
  if [ -f bun.lockb ]; then bun install --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV STANDALONE 1
RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app


RUN addgroup --system --gid 1001 bunjs
RUN adduser --system --uid 1001 sveltekit

#COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=sveltekit:bunjs /app/out ./

USER sveltekit

EXPOSE 3000

ENV PORT 3000

CMD ["bun", "index.js"]

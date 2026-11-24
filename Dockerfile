# The site in a container. Only the dependencies are installed here: the site itself is
# built when the container starts (scripts/start.sh), because Next.js prerenders pages
# from the database and the chain, and the database is only reachable then.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]

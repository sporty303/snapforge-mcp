# Minimal image so Glama (and anyone) can build the server and introspect its tools.
# The server speaks MCP over stdio and lists its tools without any API key — a key
# (via the snapforge_signup tool or SNAPFORGE_API_KEY) is only needed to actually render.
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.js ./
ENTRYPOINT ["node", "index.js"]

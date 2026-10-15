FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

# npm 10 (bundled with Node 22) crashes on Nuxt 4's peer dependency graph
# ("Cannot read properties of null (reading 'edgesOut')"); npm 11 resolves it.
RUN npm install -g npm@11

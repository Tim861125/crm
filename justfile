default:
  @just --list

dev:
  bun run dev

test:
  bun run test

lint:
  bun run lint

db-generate:
  bun run db:generate

db-migrate:
  bun run db:migrate

# Cloudflare Workers 部署：build（cloudflare_module preset）→ wrangler deploy
deploy:
  bun run build
  npx wrangler deploy

# D1 遷移：本地／線上
db-push:
  npx wrangler d1 migrations apply amway-crm-db --local

db-push-remote:
  npx wrangler d1 migrations apply amway-crm-db --remote

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

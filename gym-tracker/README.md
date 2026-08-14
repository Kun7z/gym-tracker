# Gym Tracker 🏋️

Aplicativo **mobile-first** para uma dor específica de academia:

> **"Quero abrir um exercício e saber quanto eu estava levantando antes e quanto
> estou levantando agora — independentemente de qual treino eu estava fazendo."**

Histórico de séries (peso × repetições × data) por **exercício**, com gráficos
de progressão (carga, volume, e1RM) — sem o conceito de "treino" como unidade.

## Status

- ✅ **Backend MVP completo** (NestJS + Prisma/PostgreSQL): auth JWT, catálogo
  sincronizado do wger, séries idempotentes offline, histórico/estatísticas
- ✅ **Catálogo** sincronizado da API pública do wger (sob demanda)
- ✅ 28 testes unitários + 21 e2e verdes; smoke test fim-a-fim com dados reais
- 🚧 **Frontend Angular** (próximo passo) · 🚧 Deploy

## Estrutura

```
backend/          # API NestJS (auth, catalog, sets, stats)
infrastructure/   # Docker Compose (Postgres), scripts, README de operação
```
## Quick start

```bash
# Banco dev
docker compose -f infrastructure/docker-compose.yml up -d postgres

# Backend
cd backend && npm install && npm run start:dev
```

Verificação: `cd backend && npm run lint && npm test && npm run test:e2e`
ou `bash infrastructure/scripts/smoke-test.sh` (fim-a-fim com o wger real).

# Carga — Frontend (Angular PWA)

Aplicativo **mobile-first** do Gym Tracker. Tema dark por padrão, com opção de
tema claro; paleta laranja (ação/carga) + verde-teal (sucesso/recorde).

## Rodando

```bash
cd frontend
npm install
npm start          # http://localhost:4200 (proxy /api -> localhost:3000)
```

O backend deve estar rodando em `http://localhost:3000` (ver `../infrastructure`
e o README do projeto). Em produção, o `API_BASE` é relativo (`/api/v1`) — basta
servir o PWA e a API atrás do mesmo domínio.

## Testar no celular (mesma rede Wi-Fi)

O `npm start` já sobe o servidor em `0.0.0.0` (acessível pela rede local):

1. Descubra o IP da sua máquina: `hostname -I` (ex.: `192.168.1.155`)
2. No celular, abra `http://<IP>:4200`
3. Se não abrir, verifique o firewall do Linux:
   `sudo ufw status` → se estiver ativo, libere a porta:
   `sudo ufw allow 4200/tcp`

> O celular precisa estar na **mesma rede Wi-Fi** e o roteador não pode ter
> isolamento de cliente (AP isolation) ativo.

## Scripts

| Comando      | Descrição                          |
| ------------ | ---------------------------------- |
| `npm start`  | Dev server (porta 4200, com proxy) |
| `npm run build` | Build de produção (com PWA)     |
| `npm test`   | Testes unitários (Vitest)          |

## Estrutura

```
src/
├── app/
│   ├── core/          # api (client + interceptor de refresh), auth, theme, toast
│   ├── features/
│   │   ├── auth/      # login / registro
│   │   ├── home/      # busca + filtro por equipamento + recentes + lista
│   │   ├── exercise/  # detalhe: resumo, gráfico, histórico, exclusão
│   │   └── log/       # bottom sheet de registro de série (steppers)
│   └── shared/        # modelos, utilitários, chart (SVG), sheet, stepper
├── styles.scss        # design system (tokens dark/light + primitivas)
└── public/            # manifest PWA + ícones da marca
```

## Decisões

- **Auth**: access token só em memória; refresh em cookie httpOnly do backend.
  O interceptor renova automaticamente em 401 (1 retry, sem loop).
- **Gráfico**: SVG próprio (sem biblioteca) — leve, toque nativo e 100% alinhado
  ao design system. Alternativa documentada: Apache ECharts (`ngx-echarts`).
- **Offline**: o registro já gera `clientUuid` (idempotência no backend). A fila
  offline com IndexedDB (Dexie) é o próximo passo (ver `contexto.md`).

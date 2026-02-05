# Dashboard n8n (Vercel-ready)

## Variável de ambiente (Vercel)
Crie no Vercel:
- `VITE_SALES_API_URL` = `https://SEU_SUBDOMINIO.app.n8n.cloud/webhook/sales-json`

Se seu endpoint exigir token por querystring:
- `https://.../webhook/sales-json?token=SEU_TOKEN`

## Rodar local
```bash
npm install
npm run dev
```

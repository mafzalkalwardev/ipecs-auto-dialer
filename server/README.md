# IPECS Auto Dialer — accounts server

Express + Postgres API (trial, login, one-device lock, `/admin`). Deployed on **Vercel** with **Neon**.

## Vercel deploy (recommended)

```powershell
cd server
npm install
vercel link --scope indus14 --yes
vercel env add DATABASE_URL production
vercel env add ADMIN_USER production
vercel env add ADMIN_PASSWORD production
vercel env add BRAND_NAME production          # Indus Web Agency
vercel env add BRAND_PRODUCT production       # IPECS Auto Dialer by Indus Web Agency
vercel env add SUPPORT_WHATSAPP production    # +92 307 9670503
vercel env add SUPPORT_WHATSAPP_LINK production
vercel env add SUPPORT_URL production         # https://www.induswebagency.com
vercel --prod --scope indus14
```

Then set in the extension:

```js
// config.js
export const ACCOUNTS_API_BASE = 'https://ipecs-auto-dialer-accounts.vercel.app';
```

And matching `host_permissions` in `manifest.json`.

## Admin

Visit `/admin` with `ADMIN_USER` / `ADMIN_PASSWORD`. Approve users and set plan length by hand.

# IPECS Auto Dialer by Indus Web Agency

Chrome extension for UK outbound calling on iPECS Cloud — lead import, auto-dial queue, call outcomes, and XLSX reports.

---

## Project Showcase

IPECS Auto Dialer by Indus Web Agency is a Chrome MV3 side-panel dialer that turns [iPECS Cloud](https://one3.ipecs-cloud.co.uk/call) into a queue-based outbound calling console for UK numbers. Import CSV or Excel leads, auto-dial with a configurable delay, tag each call outcome from an on-page HUD, and export an XLSX call report — while you stay signed in on `one3.ipecs-cloud.co.uk`.

It includes a subscription gate (trial + admin-approved plans) with one device per account, Indus Web Agency branding, and WhatsApp support.

> Compliance note: this extension can place real calls through iPECS Cloud. You are responsible for consent, Do Not Call rules, recording disclosure, spam prevention, local law, and your iPECS / carrier account limits.

---

## Features

- Import CSV / Excel lead lists (UK mobiles `07…` and `+44…`, including Excel numbers without a leading `0`)
- Auto-dial queue with configurable delay between calls
- Drives the **left** iPECS dialpad (`Search by name, number` + green voice call)
- Detects live calls via Connected timer and red hang-up control
- On-page Dialer HUD for outcomes while you stay on iPECS
- Export XLSX call report
- Trial + admin-approved plans, one device per account
- Made by [Indus Web Agency](https://www.induswebagency.com) · WhatsApp [+92 307 9670503](https://wa.me/923079670503)

---

## Live backends

| | |
|---|---|
| **Accounts API** | [ipecs-auto-dialer-accounts.vercel.app](https://ipecs-auto-dialer-accounts.vercel.app) |
| **Admin** | [/admin](https://ipecs-auto-dialer-accounts.vercel.app/admin) |
| **Privacy** | [/privacy](https://ipecs-auto-dialer-accounts.vercel.app/privacy) |
| **Dialer host** | `https://one3.ipecs-cloud.co.uk/call` |

---

## Load unpacked (dev)

1. Open Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
2. Select this folder (`ipecs-auto-dialer` — the one that contains `manifest.json`)
3. Open `https://one3.ipecs-cloud.co.uk/call` and sign in to iPECS
4. Click the extension icon → open the side panel → start trial / log in
5. Import `sample-leads.csv` (or your UK Excel) and start dialing

Need help? WhatsApp [+92 307 9670503](https://wa.me/923079670503) or visit [induswebagency.com](https://www.induswebagency.com).

---

## Chrome Web Store

Store zip: `../ipecs-auto-dialer-webstore.zip`  
Listing copy and permission justifications: [`PUBLISHING.md`](./PUBLISHING.md) · [`STORE-LISTING.txt`](./STORE-LISTING.txt)

Privacy policy URL for the store form:  
`https://ipecs-auto-dialer-accounts.vercel.app/privacy`

---

## Accounts server

Express + Postgres (Neon) on Vercel. See [`server/README.md`](./server/README.md).

Point the extension at the live URL in `config.js` (`ACCOUNTS_API_BASE`) and matching `host_permissions` in `manifest.json`.

---

## Architecture

```
sidepanel ──► background (service worker) ──► accounts API (Vercel + Neon)
                      │
                      └── port: ipecs-content ──► content script
                                                    on one3.ipecs-cloud.co.uk
```

When dialing breaks, on the iPECS tab DevTools run `IPECSSel.probe()` and repair `content/selectors.js`.

---

## Tech stack

| Layer | Tools |
|---|---|
| Extension | Chrome MV3, side panel, content scripts |
| Dialer host | iPECS Cloud (`one3.ipecs-cloud.co.uk`) |
| Accounts | Express, Postgres (Neon), Vercel |
| Leads / reports | CSV, XLSX (SheetJS) |

---

## Support

- **Indus Web Agency** — [induswebagency.com](https://www.induswebagency.com)
- **WhatsApp** — [+92 307 9670503](https://wa.me/923079670503)

---

Built for practical UK outbound dialing on iPECS Cloud: queue automation, real call-state detection, and Indus Web Agency support.

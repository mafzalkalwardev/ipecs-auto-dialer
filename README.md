<div align="center">

# IPECS Auto Dialer by Indus Web Agency

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=26&duration=2800&pause=700&color=0EA5E9&center=true&vCenter=true&width=900&lines=Chrome+MV3+UK+Outbound+Dialer;iPECS+Cloud+Auto-Dial+Queue;Lead+Import+%2B+Outcomes+%2B+XLSX+Reports;Built+by+Indus+Web+Agency" alt="Typing SVG" />

<p>
  <img src="https://komarev.com/ghpvc/?username=mafzalkalwardev&label=Project%20Views&color=0ea5e9&style=for-the-badge" alt="Project views" />
  <img src="https://img.shields.io/github/stars/mafzalkalwardev/ipecs-auto-dialer?style=for-the-badge&color=22c55e" alt="GitHub stars" />
  <img src="https://img.shields.io/github/forks/mafzalkalwardev/ipecs-auto-dialer?style=for-the-badge&color=f59e0b" alt="GitHub forks" />
  <img src="https://img.shields.io/github/license/mafzalkalwardev/ipecs-auto-dialer?style=for-the-badge&color=64748b" alt="License" />
</p>

<p>
  <img src="https://skillicons.dev/icons?i=js,html,css,nodejs,chrome,vercel,postgres,githubactions,windows" alt="Skill icons" />
</p>

<p>
  <strong>Chrome extension for UK outbound calling on iPECS Cloud — lead import, auto-dial queue, call outcomes, and XLSX reports.</strong>
</p>

</div>

---

## Project Showcase

IPECS Auto Dialer by Indus Web Agency is a Chrome MV3 side-panel dialer that turns [iPECS Cloud](https://one3.ipecs-cloud.co.uk/call) into a queue-based outbound calling console for UK numbers. Import CSV or Excel leads, auto-dial with a configurable delay, tag each call outcome from an on-page HUD, and export an XLSX call report — while you stay signed in on `one3.ipecs-cloud.co.uk`.

It includes a subscription gate (trial + admin-approved plans) with one device per account, Indus Web Agency branding, and WhatsApp support.

> Compliance note: this extension can place real calls through iPECS Cloud. You are responsible for consent, Do Not Call rules, recording disclosure, spam prevention, local law, and your iPECS / carrier account limits.

---

## SEO Keywords

`IPECS auto dialer` `iPECS Cloud Chrome extension` `UK outbound dialer` `Chrome MV3 side panel dialer` `UK call queue automation` `Excel lead import dialer` `XLSX call report` `Indus Web Agency` `one3.ipecs-cloud.co.uk` `VoIP auto dialer UK`

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

## Compliance and Responsible Use

This extension can place real outbound calls through iPECS Cloud. It is intended for lawful, permission-based business workflows only. Users are responsible for:

- **Consent** and permission-based outreach before calling
- **Do Not Call** lists and applicable telemarketing regulations
- **Caller ID** accuracy and business identification
- **Recording disclosure** where required by law
- **iPECS / carrier** account limits and spam prevention
- Local privacy and telecommunications laws

This software must not be used for spam, harassment, deceptive robocalling, or unauthorized calling.

---

## License

This project is licensed under the [MIT License](./LICENSE).

Community docs: [Code of Conduct](./CODE_OF_CONDUCT.md) · [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md)

---

## Support

- **Indus Web Agency** — [induswebagency.com](https://www.induswebagency.com)
- **WhatsApp** — [+92 307 9670503](https://wa.me/923079670503)

---

<div align="center">

Built for practical UK outbound dialing on iPECS Cloud: queue automation, real call-state detection, and Indus Web Agency support.

</div>

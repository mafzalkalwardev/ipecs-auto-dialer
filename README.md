<div align="center">

# IPECS Auto Dialer

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=28&duration=2800&pause=700&color=2563EB&center=true&vCenter=true&width=900&lines=UK+Outbound+Calling+on+iPECS+Cloud;Chrome+MV3+Queue+Dialer+Extension;Built+by+Indus+Web+Agency;Trial+%2B+Subscription+Ready+Workflow" alt="Typing SVG" />

<p>
  <img src="https://komarev.com/ghpvc/?username=mafzalkalwardev&label=Project%20Views&color=2563eb&style=for-the-badge" alt="Project views" />
  <img src="https://img.shields.io/github/stars/mafzalkalwardev/ipecs-auto-dialer?style=for-the-badge&color=22c55e" alt="GitHub stars" />
  <img src="https://img.shields.io/github/forks/mafzalkalwardev/ipecs-auto-dialer?style=for-the-badge&color=f59e0b" alt="GitHub forks" />
  <img src="https://img.shields.io/github/license/mafzalkalwardev/ipecs-auto-dialer?style=for-the-badge&color=64748b" alt="License" />
</p>

<p>
  <img src="https://skillicons.dev/icons?i=js,chrome,html,css,nodejs" alt="Skill icons" />
</p>

<p>
  <strong>Chrome MV3 auto dialer for iPECS Cloud outbound calling — queue dialing, trial/subscription flows, and operator-friendly controls.</strong>
</p>

</div>

---

## Trophy Cards

<div align="center">
  <img src="https://github-profile-trophy.vercel.app/?username=mafzalkalwardev&theme=algolia&no-frame=true&no-bg=true&margin-w=12&margin-h=12&column=4" alt="GitHub trophy cards" />
</div>

---

## Stats Cards

<div align="center">
  <img height="165" src="https://github-readme-stats-sigma-five.vercel.app/api?username=mafzalkalwardev&show_icons=true&theme=tokyonight&hide_border=true&rank_icon=github" alt="GitHub stats" />
  <img height="165" src="https://github-readme-stats-sigma-five.vercel.app/api/top-langs/?username=mafzalkalwardev&layout=compact&theme=tokyonight&hide_border=true" alt="Top languages" />
</div>

---

## Activity Graph

<div align="center">
  <img src="https://github-readme-activity-graph.vercel.app/graph?username=mafzalkalwardev&theme=react-dark&hide_border=true&area=true" alt="GitHub activity graph" />
</div>

---

## Contribution Snake

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mafzalkalwardev/google-voice-dispatch-agent/output/github-contribution-grid-snake-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mafzalkalwardev/google-voice-dispatch-agent/output/github-contribution-grid-snake.svg">
    <img alt="Contribution snake" src="https://raw.githubusercontent.com/mafzalkalwardev/google-voice-dispatch-agent/output/github-contribution-grid-snake.svg">
  </picture>
</div>

---

## SEO Keywords

`iPECS dialer` `Chrome extension` `outbound calling` `UK dialer` `MV3`

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

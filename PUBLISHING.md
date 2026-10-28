# Publishing — IPECS Auto Dialer by Indus Web Agency

## Live backends

| | |
|---|---|
| Accounts API | https://ipecs-auto-dialer-accounts.vercel.app |
| Admin | https://ipecs-auto-dialer-accounts.vercel.app/admin |
| Privacy policy | https://ipecs-auto-dialer-accounts.vercel.app/privacy |
| Support WhatsApp | +92 307 9670503 |
| Website | https://www.induswebagency.com |

Admin login: `afzal` (same password as Indus GV admin).

## Build the Chrome Web Store zip

From PowerShell:

```powershell
cd "D:\IPECS Auto Dialer\ipecs-auto-dialer"
$dest = "..\ipecs-auto-dialer-webstore.zip"
if (Test-Path $dest) { Remove-Item $dest -Force }
$stage = Join-Path $env:TEMP "ipecs-webstore-stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item manifest.json,background.js,config.js $stage
Copy-Item -Recurse content,sidepanel,lib,icons $stage
# Drop any non-store junk if present under lib
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $dest -Force
Remove-Item $stage -Recurse -Force
Write-Host "Wrote $dest"
```

Zip root must contain `manifest.json` (not a nested folder).

**Include:** `manifest.json`, `background.js`, `config.js`, `content/`, `sidepanel/`, `lib/`, `icons/`  
**Exclude:** `server/`, `test/`, `*.md`, `.git`, `node_modules`, sample CSVs, credentials

## Chrome Web Store listing

**Name:** IPECS Auto Dialer by Indus Web Agency

**Short description (117 chars):**  
IPECS Auto Dialer by Indus Web Agency - import leads, auto-dial UK numbers on iPECS Cloud, tag outcomes, export XLSX.

**Detailed description:**

```
IPECS Auto Dialer by Indus Web Agency is a queue-based outbound dialer for iPECS Cloud (UK).

Import a CSV or Excel lead list, auto-dial contacts with a configurable delay, tag each call outcome, and export an XLSX call report — all from a Chrome side panel while you work on one3.ipecs-cloud.co.uk.

Made by Indus Web Agency (https://www.induswebagency.com). Built for sales teams and agencies who already use iPECS Cloud and need a simple UK call queue.

How to use:
1. Add to Chrome and open iPECS Cloud (one3.ipecs-cloud.co.uk/call)
2. Open the extension side panel
3. Import leads and start dialing
4. Tag outcomes on the on-page HUD; download the XLSX report when done

Access is subscription-based (trial, then plans from 1 day to 1 year). Contact Indus Web Agency to activate a paid plan. Each account works on one computer at a time.

Support: WhatsApp +92 307 9670503
Website: https://www.induswebagency.com
```

**Category:** Productivity  
**Language:** English  
**Privacy policy URL:** https://ipecs-auto-dialer-accounts.vercel.app/privacy

## Permission justifications (paste into store form)

- **sidePanel** — operator UI for queue, outcomes, and account login  
- **storage** — campaign state and signed-in session on this device  
- **alarms** — periodic account revalidation  
- **tabs** — find / focus the open iPECS Cloud calling tab  
- **scripting** — inject the dialer bridge into an already-open iPECS tab after install/reload  
- **https://*.ipecs-cloud.co.uk/** — type numbers, start/end calls, read call UI on iPECS Cloud  
- **https://ipecs-auto-dialer-accounts.vercel.app/** — login, trial, subscription checks  

## Single purpose

This extension’s single purpose is outbound call-queue automation for the iPECS Cloud web dialer (UK numbers).

## Screenshots

Upload 1280×800 (or 640×400) JPEGs showing: side panel login, lead import, dialing on `/call`, outcome tagging. No alpha channel.

## After upload

1. Submit for review  
2. Smoke-test unpacked zip locally first: Load unpacked → open `/call` → trial → import `sample-leads.csv` → dial one number → End call → outcome  
3. Approve customers at `/admin`

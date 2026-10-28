# Publishing — IPECS Auto Dialer by Indus Web Agency

**Start here for go-live:** [`store-assets/GO-LIVE-CHECKLIST.txt`](./store-assets/GO-LIVE-CHECKLIST.txt)

## Package

| Item | Path |
|---|---|
| Store zip (v1.0.0) | `D:\IPECS Auto Dialer\ipecs-auto-dialer-webstore.zip` |
| Screenshots 1280×800 | `store-assets/screenshots-1280x800/` |
| Promo tiles | `store-assets/promo/` |
| Paste-ready listing | `STORE-LISTING.txt` |
| Full checklist | `store-assets/GO-LIVE-CHECKLIST.txt` |

## Live backends

| | |
|---|---|
| Accounts API | https://ipecs-auto-dialer-accounts.vercel.app |
| Admin | https://ipecs-auto-dialer-accounts.vercel.app/admin |
| Privacy policy | https://ipecs-auto-dialer-accounts.vercel.app/privacy |
| Support WhatsApp | +92 307 9670503 |
| Website | https://www.induswebagency.com |

## Rebuild the zip (if you change code)

```powershell
cd "D:\IPECS Auto Dialer\ipecs-auto-dialer"
$dest = "..\ipecs-auto-dialer-webstore.zip"
if (Test-Path $dest) { Remove-Item $dest -Force }
$stage = Join-Path $env:TEMP "ipecs-webstore-stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item manifest.json,background.js,config.js $stage
Copy-Item -Recurse content,sidepanel,lib,icons $stage
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $dest -Force
Remove-Item $stage -Recurse -Force
Write-Host "Wrote $dest"
```

Zip root must contain `manifest.json`. Exclude `server/`, `test/`, docs, `.git`, `node_modules`, `store-assets`.

## Dashboard

https://chrome.google.com/webstore/devconsole → **New item** → upload zip → fill listing from `STORE-LISTING.txt` + privacy from checklist → submit.

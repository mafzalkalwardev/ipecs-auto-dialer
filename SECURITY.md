# Security Policy

## Reporting a vulnerability

Please do not open public issues for security-sensitive problems.

Contact the repository maintainer privately (or Indus Web Agency via WhatsApp [+92 307 9670503](https://wa.me/923079670503)) with:

- Affected repository and component
- Steps to reproduce
- Impact assessment

## Supported versions

Only the default branch (`main`) receives security fixes unless noted otherwise.

## Secrets

Never commit:

- `DATABASE_URL`, admin passwords, or Vercel tokens
- `.env` / `.env.local` / `.admin-credentials*.local`
- Customer lead lists with real personal data

# داشبورد طلا و ارز — Cloudflare Pages

Persian RTL dashboard of gold & currency prices. Static site, no build step.

## Deploy on Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → Pages → Create → Connect to Git → select this repo.
3. Build settings: **no build command**, output directory: `/` (root).
4. Deploy. Done.

## Auto data updates

Two GitHub Actions workflows (in `.github/workflows/`):
- `update-data.yml` — live prices every 2h during market hours (06:00–22:00 Tehran).
- `daily-rebuild.yml` — full history rebuild daily at 08:15 Tehran.

Each push to `data/dashboard_data.json` triggers an automatic Cloudflare Pages redeploy. No approval prompts.

## Local dev

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Manual data refresh

```bash
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_data.py --live-only  # live only
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_data.py              # full rebuild
```

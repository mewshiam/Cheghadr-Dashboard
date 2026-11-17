# Auto build — Patched Android Apps

Daily CI pipeline that downloads popular Android apps, applies community
patches (Morphe / ReVanced and others), signs the result, publishes a
GitHub Release, and posts every **new version** to a Telegram channel.

Channel: [@underground_typeshit](https://t.me/underground_typeshit)

## Attribution

This repository is based on
[RookieEnough/Morphe-AutoBuilds](https://github.com/RookieEnough/Morphe-AutoBuilds)
(GPL-3.0) — the Python build engine (`src/`), the app/source
definitions (`apps/`, `sources/`), the patch-selection files
(`patches/`) and the public signing keystore are taken from that
project, with thanks. The changes here are:

- a curated 26-app list focused on apps Iranian users actually use,
- GitHub Releases instead of GitLab releases (tag `latest`),
- a Telegram posting step (`scripts/telegram_post.py`) that sends each
  new build to the channel with the app icon, the enabled patches, the
  patch date and the app version.

## How it works

1. **Daily build** — `.github/workflows/patch.yml` runs every day at
   06:00 UTC (and can be triggered manually). It builds a matrix from
   `patch-config.json` × `arch-config.json`, downloads the base APK from
   APKMirror / APKPure / Uptodown / Aptoide (via FlareSolverr), patches
   it with the Morphe/ReVanced CLI, and signs it with the public
   keystore in `keystore/public.jks`.
2. **Release** — all built APKs plus `manifest.json` (app, source, arch,
   version per build) are published to the GitHub Release with tag
   `latest`, replacing the previous assets.
3. **Telegram** — `scripts/telegram_post.py` compares the new builds
   against the previous release manifest and posts **only the apps
   whose version changed** (no daily spam). Each post carries:
   - the app icon (extracted from the APK with `aapt2`),
   - the enabled patches (the `+` lines of `patches/<app>-<source>.txt`),
   - the patch date (Shamsi date, Asia/Tehran),
   - the app version.

### The 50 MB Telegram rule

The Telegram Bot API refuses documents larger than 50 MB, and patched
APKs for apps like YouTube or Instagram are bigger than that. So:

- APK **≤ 50 MB** → sent as a document, with the app icon as the
  thumbnail and the caption above.
- APK **> 50 MB** → the icon is sent as a photo with the same caption
  plus a download link to the GitHub Release asset.

## Apps (26)

| App | Patch source |
| --- | --- |
| YouTube | morphe |
| YouTube Music | morphe |
| Spotify | revanced |
| SoundCloud | Hoo |
| Instagram | piko |
| TikTok | icysymmetra |
| X | piko |
| Threads | chiggi |
| Facebook | hushfacebook |
| Pinterest | hushpinterest |
| Telegram | paresh |
| Google Photos | akash-photos |
| Lightroom | Hoo |
| CamScanner | Hoo |
| Duolingo | Hoo |
| Prime Video | Hoo |
| Disney+ | aimal |
| Gboard | jasonwu1994 |
| Google Maps | bearinmindcat |
| Proton VPN | Hoo |
| Windscribe | rushiranpise-dev |
| WPS Office | Hoo |
| RAR | rushiranpise |
| Xodo | Hoo |
| FotMob | Hoo |
| Sofascore | Hoo |

## Required secrets

Set these in the repository Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token of the Telegram bot (from @BotFather). |
| `TELEGRAM_CHAT_ID` | The channel: `-1003737844626` (or `@underground_typeshit`). A public channel `@username` or a `-100...` id both work. |

The bot **must be an admin of the channel** with permission to post
messages. If either secret is missing, the Telegram step prints a
warning and exits successfully — the build and release still happen.

## Adding or removing apps

1. Add the app to `patch-config.json`:
   `{"app_name": "youtube", "source": "morphe"}`.
   The `source` must have a definition in `sources/<source>.json`, and
   the app must have at least one definition in `apps/<store>/`
   (APKMirror, APKPure, Uptodown, Aptoide, …).
2. Add the app to `arch-config.json` (usually `["universal"]`).
3. Optionally add `patches/<app>-<source>.txt` to choose patches:
   `+ patch-name` to force-include, `- patch-name` to exclude. Without
   this file the patch set's defaults are used.

To remove an app, delete its entries from both JSON files.

## Manual builds

- **Actions → Build and Publish Patched Apps → Run workflow**: build
  all apps, or a single app (`app` input). `force` re-posts to
  Telegram even when the version is unchanged.
- **Actions → Manual Single-App Build → Run workflow**: builds one
  app and uploads the APK as a workflow artifact only (no release,
  no Telegram post).

## Local build

```bash
git clone https://github.com/mewshiam/Auto-build.git
cd Auto-build
pip install -r requirements.txt
pip install requests beautifulsoup4
export APP_NAME="youtube"
export SOURCE="morphe"
python -m src
```

Prerequisites: Python 3.11+, a Java runtime, `zip`, and `apksigner`
from the Android SDK build-tools.

Test the Telegram step without sending anything:

```bash
export TELEGRAM_CHAT_ID=-1003737844626
export GITHUB_REPOSITORY=mewshiam/Auto-build
export DRY_RUN=1
python scripts/telegram_post.py
```

## Costs and limits

- GitHub Actions is free for **public** repositories. On a private
  repository the free plan includes 2,000 minutes/month; this pipeline
  builds ~27 APKs a day, so keep the repo public or the app list short.
- GitHub Releases have no practical size limit for these APKs.
- Telegram Bot API: 50 MB per document (see above).

## Disclaimer

This repository hosts **no APK files and no copyrighted media** — all
builds are produced in CI from third-party sources and are never
committed here. It is a build-automation toolkit for educational and
personal use, not affiliated with the Morphe team, the ReVanced team,
or any app publisher. You are responsible for complying with the
licenses and terms of the apps and patch sources you use.

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).

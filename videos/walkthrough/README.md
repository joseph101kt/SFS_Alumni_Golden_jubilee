# Portal walkthrough videos (desktop webapp, click-synced)

Explains the **browser webapp** end-to-end — alumni portal + desktop Admin. Each screen has its own VO clip matched to the capture.

## Outputs

- `out/alumni-walkthrough.mp4`
- `out/committee-walkthrough.mp4`

Scene scripts: `scenes/*.json`. VO + manifests: `vo/` (gitignored). Renders: `out/` (gitignored).

## Rebuild (synced)

```bash
cd videos/walkthrough
python3 generate-vo.py both
# optional: python3 generate-vo.py both --voice en-IN-NeerjaExpressiveNeural

WALKTHROUGH_BASE_URL="https://test-sfs-alumni-alpha.vercel.app" \
WALKTHROUGH_ALUMNI_USER="..." WALKTHROUGH_ALUMNI_PASS="..." \
WALKTHROUGH_ADMIN_USER="..." WALKTHROUGH_ADMIN_PASS="..." \
node record-synced.mjs both

bash assemble-synced.sh both
```

Default voice: **en-US-AvaMultilingualNeural** (clear product-demo delivery). Capture: Playwright **1440×900** on alpha.

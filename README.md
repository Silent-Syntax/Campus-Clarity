## Campus Clarity (TS EAMCET College Advisor)

Static web app that suggests **Top 10** Telangana engineering colleges based on:
- **TS EAMCET rank** (exact or rank band)
- **Category** (OC / BC-A … BC-E / SC / ST / EWS)
- **Budget** (fees per year)
- **Preferred branch**
- **Preferred college type** (government / private autonomous / private non-autonomous)
- Soft boosts for NAAC / NIRF / nearby location / dream colleges (when available)

### What’s included

- **College database** (local JSON under `data/`)
  - `data/college-profiles.json`: 176 TS engineering college profiles
  - `data/closing-ranks-2025-phase1.json`: Phase‑1 closing ranks (1030 college‑branch rows, 174 colleges)
- **Advisor agent**: `collegeAdvisor.js`
  - Joins profile + closing‑rank data
  - Checks eligibility using your **rank + category** against the branch cutoff
  - Filters by **budget** and **college type**
  - Ranks and renders **Top 10** matches

### Run locally (important)

Because the app loads JSON via `fetch()`, you must run it using a local server (not by double‑clicking `index.html`).

Options:
- Windows (recommended): double‑click `start.bat`
- PowerShell: run `.\start.ps1`
- VS Code / Cursor “Live Server”
- Python:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500/` in your browser.

### Data sources

The JSON files were downloaded from the public TS EAMCET cutoffs site:
- College profiles: `https://eamcet-website.vercel.app/api/college-profiles`
- Phase‑1 closing ranks: `https://eamcet-website.vercel.app/data/closing-ranks-2025-phase1.json`


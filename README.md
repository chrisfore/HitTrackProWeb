# Hit Track Pro Web

A browser-based softball/baseball hit tracking application. Record hit locations on a field diagram, track hit types and pitch details, and analyze spray charts and statistics for your team.

Companion web app to **Hit Track Pro** for iOS — data files are compatible between both platforms.

**Live site:** [https://chrisfore.github.io/HitTrackProWeb/](https://chrisfore.github.io/HitTrackProWeb/)

## Features

- **Spray Chart Tracking** — Tap on a field diagram to record where hits land
- **Hit Classification** — Categorize each hit as Fly Ball, Line Drive, Pop Up, or Grounder
- **Pitch Details** — Optionally record pitch type (Fastball, Change Up, Curve, Rise, Drop) and pitch location (High, Low, Inside, Outside, Middle)
- **Multi-Team Support** — Create and manage multiple teams with separate rosters
- **Results & Statistics** — View spray charts, hit type breakdowns, and per-player stats with date range filtering
- **PDF Export** — Generate printable reports with spray charts and statistics
- **Data Import/Export** — Export individual players, full teams, or all data as `.hitdata` files compatible with the iOS app
- **Team Logo** — Upload a logo to display on exported PDF reports
- **Dark Mode** — Toggle between light and dark themes
- **Undo Support** — Remove the most recent hit entry with confirmation

## How to Use

### Getting Started
1. Open the app and enter your team name
2. Add players with jersey numbers (name is optional) in the **Settings** tab
3. Switch to the **Track** tab to start recording hits

### Tracking Hits
1. Select a team and player from the dropdowns
2. Tap anywhere on the field to place a hit
3. Choose the hit type (required), and optionally select pitch type and location
4. Tap **Save Hit** to record it
5. The Hit History sidebar shows pitch breakdowns — tap an entry to highlight those hits on the field

### Viewing Results
1. Go to the **Results** tab to view spray charts and statistics
2. Filter by team, player, or date range
3. Click a player name in "Hits by Player" to isolate their data
4. Use **Export PDF** to generate a printable report

### Managing Data
- **Export Player/Team/All Data** — Save `.hitdata` files for backup or transfer to the iOS app
- **Import Data** — Load `.hitdata` or `.json` files from the iOS app or another browser

## Data Storage

All data is stored locally in your browser using IndexedDB. It persists across restarts but:
- Clearing browser/site data will erase your data
- Private/Incognito mode does not persist data
- Different browsers maintain separate data

**Export your data regularly as a backup.**

## Tech Stack

- Vanilla HTML, CSS, and JavaScript
- IndexedDB for local data persistence
- Canvas API for field rendering and spray charts
- No build tools or external dependencies required

## Copyright

© 2026 CROSSFIRE-FORE INC. All Rights Reserved.

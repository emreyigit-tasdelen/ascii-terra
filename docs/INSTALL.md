# Installation Guide

**English** · [Türkçe](INSTALL.tr.md)

## 1. Requirements

| Needed | Details |
|---|---|
| **Browser** | Current Chrome, Edge, Firefox or Safari with WebGL2 |
| **Node.js** | **22.13 or newer** (24 LTS recommended) for multiplayer and accounts. Download: <https://nodejs.org> |
| **Git** | Optional. With git, updates come through git; without it, through a ZIP download |

Without Node.js the game only runs single player (if Python is installed). Accounts and multiplayer need Node.

Check: run `node -v` in a terminal; you should see `v22.13` or higher.

## 2. Windows

### From a ZIP (no git needed)
1. Download **Source code (zip)** from <https://github.com/emreyigit-tasdelen/ascii-terra/releases/latest>.
2. Right-click the ZIP → **Extract All**. Pick a permanent folder (e.g. `C:\Games\ascii-terra`), not Downloads: updates and saves live there.
3. Double-click **`start.bat`** in that folder.
4. A small console window opens (the server; leave it open) and the game opens in your browser at <http://localhost:8765>.
5. If Windows Firewall asks: allow **Private networks** if friends or a tablet will connect. If you play alone, you can cancel.

### With git
```powershell
git clone https://github.com/emreyigit-tasdelen/ascii-terra.git
cd ascii-terra
.\start.bat
```

## 3. macOS and Linux

```bash
git clone https://github.com/emreyigit-tasdelen/ascii-terra.git
cd ascii-terra
node server/server.js
```

Then open <http://localhost:8765>. No `npm install` needed. `start.bat` does not run on these systems; update with `git pull` (see below).

## 4. First game

- On the start screen choose **Log in**, **Sign up** or **Guest**.
  - **Account:** progress is stored on the server and you can continue from any device. Sign-up shows a **recovery code**; it is the only way back if you forget your password, so write it down.
  - **Guest:** progress stays in that browser only (it is lost if browser data is cleared).
- A new game starts with character creation and a short tutorial. Press `H` in game for help.

## 5. Playing with friends (LAN) and tablets

1. Start the game with `start.bat` on **one computer**. It is the server and must stay on.
2. Find this line in the server console:
   ```
   For friends on your local network → http://192.168.x.x:8765
   ```
3. On other computers and tablets on the same Wi-Fi or network, type that address into the browser.
4. On a tablet, hold it **in landscape**. On iPad, Share → **Add to Home Screen** opens it full screen.

If they cannot connect:
- Are the tablet and the computer on the same network? (Guest Wi-Fi networks may isolate devices.)
- Is Node.js allowed on **private networks** in Windows Firewall? (Start → "Allow an app through Windows Firewall".)
- Does the address end with `:8765`?

To play over the internet, run the server on a VPS behind HTTPS; the client switches to `wss://` automatically. Exposing a home PC directly to the internet is not recommended.

## 6. Updating

- **With `start.bat`:** every start checks GitHub for the newest **release** (`v0.x.x`) and installs it. You do nothing.
- **ZIP install:** only new files are downloaded and files removed upstream are cleaned up. Your accounts and saves (`server/data/`) are never changed.
- **Git install:** moves to the newest release if you have no local changes; otherwise the update is skipped and nothing is touched.
- **Manually (macOS/Linux):** `git pull`.
- With no internet or on any error, the game starts with the current version.
- Only published releases are installed, never unfinished commits.

## 7. Settings

| What | How |
|---|---|
| Change the port | `PORT=9000 node server/server.js` (PowerShell: `$env:PORT=9000; node server/server.js`) |
| This computer only | `HOST=127.0.0.1 node server/server.js` (no network access) |
| Quality / performance | In game: `Esc` → **Resolution** and **Grass** |
| Rebind keys | `Esc` → key list |

## 8. Data, backups and administration

Everything lives in `server/data/` and is never committed to git:
- `terra.db`: accounts and saves (SQLite)
- `backups/`: daily backups (last 7 kept)

To back up, copy this folder while the server is stopped. To move to a new install, put the same folder there.

Admin commands (in a terminal in the game folder):
```
node server/admin.js list                 list accounts
node server/admin.js reset <name>         reset a password
node server/admin.js ban <name> | unban <name>
node server/admin.js delete <name> --yes  delete an account
node server/admin.js backup               back up now
```

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `node` is not recognized | Install Node.js, then reopen the terminal or `start.bat` |
| Server shows a "sqlite" error | Your Node is too old; install 22.13+ |
| `EADDRINUSE` / port in use | The game may already be running; close the console window or use `PORT=9000` |
| Black screen / "WebGL" error | Enable hardware acceleration in the browser, update the graphics driver |
| Game is slow | `Esc` → Resolution 50%, Grass Sparse, enlarge glyphs with `[` |
| Double-clicking `index.html` does not work | Expected; the game needs the server, use `start.bat` |
| Tablet cannot connect | The checklist in section 5 |
| No update arrived | Check internet and GitHub access; there may be no new release yet |

Still stuck? [Open an issue](https://github.com/emreyigit-tasdelen/ascii-terra/issues). Do not share personal data (passwords, recovery codes).

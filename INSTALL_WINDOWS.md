# ConstructFlow Enterprise — Windows Installation

## Recommended environment

- Windows 10 or Windows 11
- Node.js 20 LTS or Node.js 22 LTS
- npm 10 or newer
- A stable internet connection for the first installation

## Clean installation

1. Extract the ZIP completely. Do not run the project from inside the ZIP.
2. Use a short local folder such as:

   `C:\ConstructFlow`

3. Open PowerShell or Command Prompt inside that folder.
4. Check Node and npm:

   ```powershell
   node -v
   npm -v
   ```

5. Install the exact tested dependencies:

   ```powershell
   npm ci --no-audit --no-fund
   ```

6. Start the software:

   ```powershell
   npm run dev
   ```

7. Open the local address displayed by Vite, normally:

   `http://localhost:5173`

## If an earlier npm install is still loading

Press `Ctrl + C`, close the terminal, reopen it in the project folder, then run:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm cache verify
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund --loglevel=info
```

For Command Prompt, remove the folder with:

```cmd
rmdir /s /q node_modules
npm cache verify
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund --loglevel=info
```

## Network test

Run:

```powershell
npm ping --registry=https://registry.npmjs.org/
```

A successful result contains `PONG`.

If `npm ping` also hangs, the problem is the internet connection, firewall, antivirus HTTPS scanning, VPN, or an npm proxy setting—not the application.

Check proxy settings:

```powershell
npm config get proxy
npm config get https-proxy
```

On a personal connection where no proxy is required, clear incorrect values with:

```powershell
npm config delete proxy
npm config delete https-proxy
```

Do not remove proxy settings on a company network without checking with the network administrator.

## Production verification

```powershell
npm run build
npm run preview
```

The production build is generated in the `dist` folder.

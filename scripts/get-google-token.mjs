/**
 * One-time script to obtain a Google OAuth2 refresh token.
 *
 * Run:
 *   node scripts/get-google-token.mjs
 *
 * The script reads GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET from
 * .env.local automatically, opens an auth URL, starts a local server to
 * capture the redirect, exchanges the code, and prints the refresh token.
 */

import { createServer } from "http"
import { google } from "googleapis"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

// ── Load .env.local ────────────────────────────────────────────────────────────
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
try {
  const lines = readFileSync(resolve(root, ".env.local"), "utf8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (val && !process.env[key]) process.env[key] = val
  }
} catch { /* .env.local not found */ }

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error("GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env.local.")
  process.exit(1)
}

// ── OAuth2 setup ───────────────────────────────────────────────────────────────
const PORT = 3456
const REDIRECT_URI = `http://localhost:${PORT}`

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  scope: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
  ],
  prompt: "consent",
})

// ── Start local server to capture the redirect ─────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error) {
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end("<h2>Access denied.</h2><p>You can close this tab.</p>")
    server.close()
    console.error("\nAuthorization was denied:", error)
    process.exit(1)
  }

  if (!code) {
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end("<h2>Waiting for authorization...</h2>")
    return
  }

  res.writeHead(200, { "Content-Type": "text/html" })
  res.end("<h2>✓ Authorized! You can close this tab and return to the terminal.</h2>")
  server.close()

  try {
    const { tokens } = await oauth2.getToken(code)
    const refreshToken = tokens.refresh_token

    console.log("\n✓ Success! Add this line to your .env.local:\n")
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`)
    console.log("\nThen restart the dev server.")
  } catch (e) {
    console.error("\nFailed to exchange code:", e.message)
    process.exit(1)
  }
})

server.listen(PORT, () => {
  console.log("\n─────────────────────────────────────────────────────────")
  console.log("Open this URL in your browser and sign in as Tammy:\n")
  console.log(authUrl)
  console.log("\nThe refresh token will appear here automatically after you approve.")
  console.log("─────────────────────────────────────────────────────────\n")
})

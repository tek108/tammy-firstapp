import { google } from "googleapis"
import path from "path"

/**
 * Returns an authenticated Google client.
 *
 * Strategy 1 — OAuth2 refresh token (recommended for personal Google accounts):
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REFRESH_TOKEN
 *
 *   Files are created as you (the Drive owner), so storage quota and ownership
 *   work exactly like creating a file manually. Run scripts/get-google-token.ts
 *   once to generate the refresh token.
 *
 * Strategy 2 — Service account JSON key file (requires Google Workspace):
 *   GOOGLE_SERVICE_ACCOUNT_JSON_PATH   path to the downloaded JSON key file
 *
 * Strategy 3 — Service account env vars (requires Google Workspace):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_KEY
 */
export function getGoogleAuth() {
  // ── Strategy 1: OAuth2 refresh token ──────────────────────────────────────
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return oauth2
  }

  // ── Strategy 2: Service account JSON key file ──────────────────────────────
  const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH?.trim()
  if (jsonPath) {
    const resolved = path.isAbsolute(jsonPath)
      ? jsonPath
      : path.resolve(process.cwd(), jsonPath)
    return new google.auth.GoogleAuth({
      keyFile: resolved,
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/documents",
      ],
    })
  }

  // ── Strategy 3: Service account env vars ──────────────────────────────────
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim()

  if (email && rawKey) {
    const privateKey = rawKey.replace(/\\n/g, "\n")
    return new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/documents",
      ],
    })
  }

  throw new Error(
    "No Google credentials configured. Set GOOGLE_OAUTH_CLIENT_ID / " +
      "GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN in .env.local, " +
      "or set GOOGLE_SERVICE_ACCOUNT_JSON_PATH."
  )
}

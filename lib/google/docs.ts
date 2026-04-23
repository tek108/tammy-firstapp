import { google, docs_v1 } from "googleapis"
import { getGoogleAuth } from "./auth"
import type { CandidateSummary } from "@/lib/interview-summary"
import { HEADER_LABELS } from "@/lib/interview-summary"

// ─── Folder helpers ────────────────────────────────────────────────────────────

/**
 * Returns the ID of a subfolder with the given name inside parentFolderId.
 * Creates the subfolder if it does not already exist.
 */
export async function getOrCreateSubfolder(
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const auth = getGoogleAuth()
  const drive = google.drive({ version: "v3", auth })

  // Escape single quotes in the name for the Drive query
  const safeName = folderName.replace(/'/g, "\\'")

  const existing = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    spaces: "drive",
  })

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  })

  return created.data.id!
}

// ─── Document builder ──────────────────────────────────────────────────────────

/**
 * Tracks the current insertion index and accumulates batchUpdate requests.
 * All text must be inserted BEFORE formatting requests are applied —
 * Docs API processes requests in order, so inserts shift subsequent indices.
 */
class DocBuilder {
  insertRequests: docs_v1.Schema$Request[] = []
  formatRequests: docs_v1.Schema$Request[] = []
  index = 1 // Google Docs content indices are 1-based

  insert(text: string): { start: number; end: number } {
    const start = this.index
    this.insertRequests.push({
      insertText: { location: { index: this.index }, text },
    })
    this.index += text.length
    return { start, end: this.index }
  }

  heading1(start: number, end: number) {
    this.formatRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType: "HEADING_1" },
        fields: "namedStyleType",
      },
    })
  }

  heading2(start: number, end: number) {
    this.formatRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType: "HEADING_2" },
        fields: "namedStyleType",
      },
    })
  }

  bold(start: number, end: number) {
    this.formatRequests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end },
        textStyle: { bold: true },
        fields: "bold",
      },
    })
  }

  normalStyle(start: number, end: number) {
    this.formatRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        fields: "namedStyleType",
      },
    })
  }

  bullets(start: number, end: number) {
    this.formatRequests.push({
      createParagraphBullets: {
        range: { startIndex: start, endIndex: end },
        bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      },
    })
  }

  get allRequests(): docs_v1.Schema$Request[] {
    return [...this.insertRequests, ...this.formatRequests]
  }
}

// ─── Document content builder ──────────────────────────────────────────────────

function buildDocRequests(
  summary: CandidateSummary,
  docTitle: string
): docs_v1.Schema$Request[] {
  const b = new DocBuilder()

  // ── Title ──
  const titleRange = b.insert(`${docTitle}\n`)
  b.heading1(titleRange.start, titleRange.end)

  b.insert("\n")

  // ── Candidate Information heading ──
  const infoHeadingRange = b.insert("Candidate Information\n")
  b.heading2(infoHeadingRange.start, infoHeadingRange.end)

  // ── Header fields ──
  const headerKeys = Object.keys(HEADER_LABELS) as (keyof typeof HEADER_LABELS)[]
  for (const key of headerKeys) {
    const label = HEADER_LABELS[key]
    const value = summary.header[key] || "Unknown"

    const lineStart = b.index
    const labelRange = b.insert(`${label}: `)
    b.bold(labelRange.start, labelRange.end - 1) // bold the label, not the space after colon
    b.insert(`${value}\n`)
    b.normalStyle(lineStart, b.index)
  }

  b.insert("\n")

  // ── Q&A ──
  for (const item of summary.qa) {
    // Question (bold)
    const qRange = b.insert(`${item.question}\n`)
    b.bold(qRange.start, qRange.end)

    // Bullets
    if (item.bullets.length > 0) {
      const bulletsStart = b.index
      for (const bullet of item.bullets) {
        b.insert(`${bullet}\n`)
      }
      const bulletsEnd = b.index
      b.bullets(bulletsStart, bulletsEnd)
    }

    b.insert("\n")
  }

  return b.allRequests
}

// ─── Public entry point ────────────────────────────────────────────────────────

/**
 * Creates a formatted Google Doc for the given questionnaire summary.
 * - Saves inside parentFolderId / jobTitle subfolder (created if missing)
 * - Returns the URL of the created document
 */
export async function saveQuestionnaireToGoogleDocs(
  summary: CandidateSummary
): Promise<string> {
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!parentFolderId) {
    throw new Error(
      "GOOGLE_DRIVE_FOLDER_ID is not set. Add it to .env.local."
    )
  }

  const auth = getGoogleAuth()
  const drive = google.drive({ version: "v3", auth })
  const docsClient = google.docs({ version: "v1", auth })

  const candidateName = summary.header.name || "Unknown Candidate"
  const jobTitle = summary.header.jobTitle || "Unknown Role"
  const docTitle = `${candidateName} - ${jobTitle} - Screening Questionnaire`

  // Ensure the job-title subfolder exists
  const subfolderId = await getOrCreateSubfolder(parentFolderId, jobTitle)

  // Create a Google Doc directly inside the target subfolder via Drive API.
  // Using drive.files.create with mimeType 'application/vnd.google-apps.document'
  // avoids the Docs API documents.create endpoint which requires additional
  // project-level permissions (HTTP 403 "caller does not have permission").
  const file = await drive.files.create({
    requestBody: {
      name: docTitle,
      mimeType: "application/vnd.google-apps.document",
      parents: [subfolderId],
    },
    fields: "id",
  })
  const docId = file.data.id!

  // Populate and format the document
  const requests = buildDocRequests(summary, docTitle)
  if (requests.length > 0) {
    await docsClient.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    })
  }

  return `https://docs.google.com/document/d/${docId}/edit`
}

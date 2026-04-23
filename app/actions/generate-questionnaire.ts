"use server"

import Anthropic from "@anthropic-ai/sdk"
import type { CandidateSummary, HeaderFields, QAItem } from "@/lib/interview-summary"

// ─── Stage 1: Raw transcript parsing ──────────────────────────────────────────
// Handles Otter block format (timestamp / name / text on separate lines)
// and inline format (Name: text or Name [00:00]: text).

interface RawTurn {
  speaker: string // original label; "" for unattributed lines
  text: string // already cleaned of noise
}

// Patterns applied to individual content lines
const INLINE_TIMESTAMP_RE = /\[?\(?\d{1,2}:\d{2}(?::\d{2})?\]?\)?/g
const NOISE_BRACKET_RE =
  /\[(?:inaudible|crosstalk|noise|laughter|applause|music|silence|overlap|unclear|background|indistinct|ph][^\]]*)\]/gi
const NOISE_PAREN_RE =
  /\((?:inaudible|crosstalk|unclear|laughter|noise|background)[^)]*\)/gi
const FILLER_RE = /\b(um{1,3}|uh+|hmm+|mm+|er+|ah+)\b,?\s*/gi
// Speaker prefix at the start of an inline line: "TAMMY:" / "Speaker 1:" / "Tammy [0:05]:"
const INLINE_SPEAKER_PREFIX_RE =
  /^[A-ZÀ-Ö][A-Za-zÀ-ö\s.'-]{0,35}(?:\s+\d+)?(?:\s*\[\d{1,2}:\d{2}(?::\d{2})?\])?\s*[:\-–]\s+/

function cleanContentLine(raw: string): string {
  return raw
    .replace(INLINE_TIMESTAMP_RE, "")
    .replace(INLINE_SPEAKER_PREFIX_RE, "")
    .replace(NOISE_BRACKET_RE, "")
    .replace(NOISE_PAREN_RE, "")
    .replace(FILLER_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isPureTimestamp(line: string): boolean {
  return /^\[?\(?\d{1,2}:\d{2}(?::\d{2})?\]?\)?$/.test(line.trim())
}

/**
 * Decides whether a line is an Otter-style standalone speaker name.
 * Criteria: 1–3 words, all capitalised, no sentence-ending punctuation, no digits.
 */
function isStandaloneSpeakerName(line: string): boolean {
  const l = line.trim()
  if (!l) return false
  if (/[.!?,;:0-9]/.test(l)) return false
  const words = l.split(/\s+/)
  if (words.length < 1 || words.length > 3) return false
  return words.every((w) => /^[A-ZÀ-Ö]/.test(w))
}

function parseTranscriptTurns(raw: string): RawTurn[] {
  const lines = raw.split("\n")
  const turns: RawTurn[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    if (!line) { i++; continue }

    // Skip pure timestamp lines
    if (isPureTimestamp(line)) { i++; continue }

    // ── Otter block: standalone name line followed by content ──
    if (isStandaloneSpeakerName(line)) {
      const speaker = line
      const contentLines: string[] = []
      i++
      while (i < lines.length) {
        const next = lines[i].trim()
        if (!next) break // blank line ends the block
        if (isPureTimestamp(next)) break
        if (isStandaloneSpeakerName(next) && contentLines.length > 0) break
        const cleaned = cleanContentLine(next)
        if (cleaned) contentLines.push(cleaned)
        i++
      }
      if (contentLines.length > 0) {
        const text = contentLines.join(" ").replace(/\s+/g, " ").trim()
        if (wordCount(text) >= 3) turns.push({ speaker, text })
      }
      continue
    }

    // ── Inline speaker prefix: "Name: text" or "Name [0:05]: text" ──
    const inlineMatch = line.match(
      /^([A-ZÀ-Ö][A-Za-zÀ-ö\s.'-]{0,30}(?:\s+\d+)?(?:\s*\[\d{1,2}:\d{2}(?::\d{2})?\])?)\s*[:\-–]\s+(.+)/
    )
    if (inlineMatch) {
      const speaker = inlineMatch[1].trim()
      const firstLine = cleanContentLine(inlineMatch[2])
      const contentLines = firstLine ? [firstLine] : []
      i++
      // Collect continuation lines (no speaker prefix, no timestamp, no blank)
      while (i < lines.length) {
        const next = lines[i].trim()
        if (!next) break
        if (isPureTimestamp(next)) break
        if (isStandaloneSpeakerName(next)) break
        if (
          /^[A-ZÀ-Ö][A-Za-zÀ-ö\s.'-]{0,30}(?:\s+\d+)?\s*[:\-–]\s+/.test(next)
        )
          break
        const cleaned = cleanContentLine(next)
        if (cleaned) contentLines.push(cleaned)
        i++
      }
      const text = contentLines.join(" ").replace(/\s+/g, " ").trim()
      if (wordCount(text) >= 3) turns.push({ speaker, text })
      continue
    }

    // ── Unstructured line: append to last turn or start new anonymous turn ──
    const cleaned = cleanContentLine(line)
    if (cleaned && wordCount(cleaned) >= 3) {
      const last = turns[turns.length - 1]
      if (last && last.speaker === "") {
        last.text += " " + cleaned
      } else {
        turns.push({ speaker: "", text: cleaned })
      }
    }
    i++
  }

  return turns
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length
}

// ─── Stage 2: Speaker role identification ─────────────────────────────────────
// Score each speaker as interviewer or candidate based on linguistic signals.

type SpeakerRole = "interviewer" | "candidate"

const INTERVIEWER_SIGNALS =
  /\b(tell me|what (is|are|was|were|do|does|did)|how (do|did|would|have)|why did|when did|where (do|did|are)|can you|could you|walk me|describe|explain|talk me through|what('s| is) your)\b/i
const CANDIDATE_SIGNALS =
  /\b(i (have|had|am|was|worked|joined|started|built|led|managed|developed)|i've (been|worked|built)|my (role|team|company|background|experience|responsibility))\b/i

function identifySpeakerRoles(turns: RawTurn[]): Map<string, SpeakerRole> {
  const scores = new Map<
    string,
    { interviewerScore: number; candidateScore: number }
  >()

  for (const turn of turns) {
    if (!turn.speaker) continue
    if (!scores.has(turn.speaker))
      scores.set(turn.speaker, { interviewerScore: 0, candidateScore: 0 })

    const s = scores.get(turn.speaker)!
    const text = turn.text

    if (text.includes("?")) s.interviewerScore += 3
    if (INTERVIEWER_SIGNALS.test(text)) s.interviewerScore += 2
    if (CANDIDATE_SIGNALS.test(text)) s.candidateScore += 2
    // Long answers strongly suggest candidate
    if (wordCount(text) > 60) s.candidateScore += 3
    if (wordCount(text) < 30) s.interviewerScore += 1
  }

  const speakers = Array.from(scores.keys())
  const roleMap = new Map<string, SpeakerRole>()

  if (speakers.length === 0) return roleMap

  // Sort by net interviewer tendency (desc)
  const ranked = [...speakers].sort((a, b) => {
    const sa = scores.get(a)!
    const sb = scores.get(b)!
    return (
      sb.interviewerScore -
      sb.candidateScore -
      (sa.interviewerScore - sa.candidateScore)
    )
  })

  roleMap.set(ranked[0], "interviewer")
  for (let i = 1; i < ranked.length; i++) {
    roleMap.set(ranked[i], "candidate")
  }
  return roleMap
}

// ─── Stage 3: Build anonymised transcript ─────────────────────────────────────
// Replaces all speaker names with "Interviewer" / "Candidate".

function buildAnonymisedTranscript(
  turns: RawTurn[],
  roleMap: Map<string, SpeakerRole>
): string {
  const lines: string[] = []

  for (const turn of turns) {
    const role = turn.speaker
      ? (roleMap.get(turn.speaker) ?? "candidate")
      : "candidate"
    const label = role === "interviewer" ? "Interviewer" : "Candidate"
    lines.push(`${label}: ${turn.text}`)
  }

  return lines.join("\n\n")
}

/**
 * Full pipeline: parse → role-identify → anonymise.
 * Returns a clean transcript with only "Interviewer: …" and "Candidate: …" lines.
 */
function prepareTranscript(raw: string): string {
  const turns = parseTranscriptTurns(raw)

  if (turns.length < 2) {
    // Not enough structure — do a minimal inline clean and return as-is
    return raw
      .replace(INLINE_TIMESTAMP_RE, "")
      .replace(NOISE_BRACKET_RE, "")
      .replace(NOISE_PAREN_RE, "")
      .replace(FILLER_RE, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  const roleMap = identifySpeakerRoles(turns)
  return buildAnonymisedTranscript(turns, roleMap)
}

// ─── System prompt (stable — eligible for prompt-cache on repeated calls) ─────

const SYSTEM_PROMPT = `You are an internal recruiting writing assistant for Tammy at Telescope Recruitment.

Your task is to produce exactly one output: a Screening Questionnaire.

The user will provide a cleaned interview transcript where all speaker names have been replaced with "Interviewer:" and "Candidate:".
You may also receive recruiter notes and a resume.

Return ONLY valid JSON in this exact schema:
{
  "header": {
    "jobTitle": "",
    "name": "",
    "communication": "",
    "linkedin": "",
    "designation": "",
    "noticePeriod": "",
    "plannedVacations": "",
    "location": "",
    "workStatus": "",
    "salary": ""
  },
  "qa": [
    {
      "question": "Question sentence",
      "bullets": [
        "First-person bullet ~15 words",
        "..."
      ]
    }
  ]
}

─── CORE RULES ─────────────────────────────────────────────────────
• Never invent facts
• Never present assumptions as facts
• Use only information explicitly supported by the transcript, notes, or resume
• Do not include timestamps
• Do not include raw transcript fragments
• Do not include speaker names anywhere except in the "name" header field
• Do not generate an "Interview summary" section or any generic catch-all section
• Do not repeat header information inside the Q&A section
• Never use em dashes (—) anywhere in the output. Use commas or parentheses instead

─── HEADER RULES ───────────────────────────────────────────────────
• Extract only values explicitly supported by the source material
• If a field is missing, write "Unknown"
• "communication": spoken languages and proficiency level only (e.g. "English: Native, Hebrew: 7/10") — no personality traits, no commentary
• "workStatus": legal work authorisation status only (e.g. "Citizen", "Permanent Resident", "Work Permit") — no employment situation, no job search status
• Do not add commentary inside header fields

─── Q&A ORDER ──────────────────────────────────────────────────────
Order questions in this natural reading sequence, covering only topics that were actually discussed:
1. Background and career path
2. Current role
3. Responsibilities
4. Relevant experience
5. Tools and systems
6. Achievements and examples
7. Leadership and people management
8. Motivation, reasons for moving, what they are looking for

─── Q&A RULES ──────────────────────────────────────────────────────
• Generate 11–15 questions maximum
• Every question must be directed to the candidate in second person
• Vary the question openings naturally. Use a mix of:
  - "Can you walk me through..."
  - "What did you..."
  - "How did you..."
  - "Why did you..."
  - "Can you give me an example of..."
  - "Tell me about..."
  - "What does your day-to-day look like..."
  - "How do you typically..."
• Do not repeat the same question opening more than twice in the full list
• NEVER write generic third-person question styles like:
  - "What is the experience..."
  - "Describe the experience..."
  - "Summarize the role..."
• Questions must be specific, natural, and candidate-facing
• Questions must be based only on topics actually discussed
• Each question must cover exactly one topic — do not combine multiple different ideas into a single question
• Do NOT generate questions about anything already shown in the header: name, communication, LinkedIn, designation, notice period, planned vacations, location, work status, salary

─── ANSWER RULES ───────────────────────────────────────────────────
• Answers must clearly sound like the candidate speaking in first person
• Most bullets should begin with "I" — it is acceptable if not every single bullet starts with "I", but the voice must stay clearly first person throughout
• Never let bullets sound like neutral notes, third-person summaries, or passive descriptions
• Each question must have 4–6 bullet points
• Each bullet must be 10–18 words, target around 15 words
• Each bullet must contain one clear idea only
• Bullets must read like clean, natural English — not compressed or note-like
• Prefer concrete detail: ownership, actions, scope, tools, and numbers when available
• Avoid filler, vague wording, and robotic repetition across bullets
• Do not write paragraphs
• Do not write "he said", "she said", or "the candidate said"
• Do not copy transcript wording directly — rewrite into clear, simple, readable English

─── STYLE RULES ────────────────────────────────────────────────────
• Keep language simple, practical, and easy to scan
• Questions should feel like real screening questions a recruiter would ask
• Each Q&A block should be focused and easy to scan — one topic, one question, one set of bullets
• Bullets should feel concise, human, and recruiter-friendly
• Do not make the tone formal or corporate
• Do not over-explain`

// ─── Claude extraction ─────────────────────────────────────────────────────────

async function extractWithClaude(
  client: Anthropic,
  cleanedTranscript: string,
  notes?: string,
  resume?: string
): Promise<CandidateSummary> {
  const parts: string[] = [
    `Cleaned interview transcript:\n\n${cleanedTranscript}`,
  ]
  if (notes?.trim()) parts.push(`Recruiter notes:\n${notes.trim()}`)
  if (resume?.trim()) parts.push(`Candidate resume:\n${resume.trim()}`)

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // cache stable prompt across calls
      },
    ],
    messages: [{ role: "user", content: parts.join("\n\n---\n\n") }],
  })

  const message = await stream.finalMessage()

  for (const block of message.content) {
    if (block.type === "text") {
      const parsed = tryParseJSON(block.text)
      if (parsed) return parsed
    }
  }

  throw new Error("Claude did not return valid JSON")
}

function tryParseJSON(text: string): CandidateSummary | null {
  // 1. Try the whole text as-is
  try { return JSON.parse(text.trim()) as CandidateSummary } catch {}

  // 2. Extract from markdown code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) {
    try { return JSON.parse(fence[1].trim()) as CandidateSummary } catch {}
  }

  // 3. Find the first balanced JSON object (avoids greedy-regex over-matching
  //    when Claude adds text after the closing brace)
  const candidate = extractFirstJsonObject(text)
  if (candidate) {
    try { return JSON.parse(candidate) as CandidateSummary } catch {}
  }

  return null
}

/**
 * Scans `text` for the first top-level `{...}` with balanced braces,
 * skipping braces inside strings and ignoring escaped characters.
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === "\\") { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

// ─── Deterministic fallback (no API key) ──────────────────────────────────────
// Uses the same cleaning pipeline, then extracts Q&A from labelled turns.

const QUESTION_STARTERS =
  /^(tell me|what|how|why|when|where|can you|could you|walk me|describe|explain|talk me|do you|have you|are you)/i

function isLikelyQuestion(text: string): boolean {
  return (
    text.trim().endsWith("?") ||
    QUESTION_STARTERS.test(text.trim()) ||
    wordCount(text) < 30
  )
}

function textToBullets(text: string): string[] {
  // Split on sentence boundaries
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => wordCount(s) >= 5 && s.length > 20)

  return sentences.slice(0, 6).map((s) => {
    const words = s.split(/\s+/)
    // Trim to ~18 words max to keep bullets concise
    return words.length > 18 ? words.slice(0, 17).join(" ") : s
  })
}

function parseTranscriptDeterministically(raw: string): CandidateSummary {
  // Run the full cleaning pipeline first
  const cleanedTranscript = prepareTranscript(raw)

  // Split into labelled turns: "Interviewer: ..." and "Candidate: ..."
  const labelledTurnRE = /^(Interviewer|Candidate):\s+(.+)$/gm
  type LabelledTurn = { role: "interviewer" | "candidate"; text: string }
  const turns: LabelledTurn[] = []

  let m: RegExpExecArray | null
  while ((m = labelledTurnRE.exec(cleanedTranscript)) !== null) {
    turns.push({
      role: m[1] === "Interviewer" ? "interviewer" : "candidate",
      text: m[2].trim(),
    })
  }

  // Fall back to unlabelled parsing if labelling found nothing
  if (turns.length === 0) {
    return parseUnlabelled(cleanedTranscript, raw)
  }

  // Build Q&A pairs: each Interviewer turn + the immediately following Candidate turn
  const qa: QAItem[] = []
  for (let i = 0; i < turns.length - 1; i++) {
    if (
      turns[i].role === "interviewer" &&
      turns[i + 1]?.role === "candidate"
    ) {
      const question = turns[i].text
      const bullets = textToBullets(turns[i + 1].text)

      // Skip if we don't have enough content
      if (bullets.length < 2) { i++; continue }

      qa.push({ question, bullets })
      i++ // consume the candidate turn
    }
  }

  return { header: extractHeader(raw), qa }
}

/**
 * Last-resort parser for transcripts with no identifiable speaker structure.
 * Looks for question-like sentences followed by longer answers.
 */
function parseUnlabelled(cleaned: string, raw: string): CandidateSummary {
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => wordCount(p) >= 4)

  const qa: QAItem[] = []

  for (let i = 0; i < paragraphs.length - 1; i++) {
    const para = paragraphs[i]
    const next = paragraphs[i + 1]

    if (isLikelyQuestion(para) && !isLikelyQuestion(next)) {
      const bullets = textToBullets(next)
      if (bullets.length >= 2) {
        qa.push({ question: para.replace(/\?$/, "?").trim(), bullets })
        i++
      }
    }
  }

  return { header: extractHeader(raw), qa }
}

// ─── Header extraction from raw transcript ─────────────────────────────────────

function extractHeader(raw: string): HeaderFields {
  const nameMatch = raw.match(
    /(?:my name is|I(?:'m| am))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/
  )
  const locationMatch = raw.match(
    /(?:based in|located in|living in|live in|from)\s+([A-Z][a-zA-Z\s]+?)(?:[.,\n]|$)/
  )
  const salaryMatch = raw.match(
    /(\d[\d,]+)\s*(ILS|NIS|USD|EUR|GBP)(?:\s*\/?\s*(?:month|monthly|per month))?/i
  )
  const noticeMatch = raw.match(
    /notice\s*period\s*(?:is|of|:)?\s*(\d+\s+(?:days?|weeks?|months?))/i
  )
  const linkedinMatch = raw.match(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i)

  return {
    jobTitle: "",
    name: nameMatch ? nameMatch[1].trim() : "",
    communication: "",
    linkedin: linkedinMatch ? linkedinMatch[1] : "",
    designation: "",
    noticePeriod: noticeMatch ? noticeMatch[1] : "",
    plannedVacations: "",
    location: locationMatch ? locationMatch[1].trim() : "",
    workStatus: "",
    salary: salaryMatch ? `${salaryMatch[1]} ${salaryMatch[2]}/month` : "",
  }
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function generateQuestionnaire(
  transcript: string,
  notes?: string,
  resume?: string
): Promise<CandidateSummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  // Always clean the transcript first — both paths benefit from it
  const cleanedTranscript = prepareTranscript(transcript)

  if (!apiKey) {
    return parseTranscriptDeterministically(transcript)
  }

  const client = new Anthropic({ apiKey })
  return extractWithClaude(client, cleanedTranscript, notes, resume)
}

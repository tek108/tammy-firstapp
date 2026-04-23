"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Copy,
  Save,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowLeft,
  Pencil,
  Upload,
  X,
  File,
} from "lucide-react"
import {
  type CandidateSummary,
  type HeaderFields,
  HEADER_LABELS,
  summaryToPlainText,
} from "@/lib/interview-summary"
import { generateQuestionnaire } from "@/app/actions/generate-questionnaire"
import { saveQuestionnaire } from "@/app/actions/save-to-google-docs"

// ─── File extraction ───────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = [".txt", ".md", ".docx"] as const
type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number]

function getExtension(filename: string): string {
  return "." + (filename.split(".").pop() ?? "").toLowerCase()
}

async function extractTextFromFile(file: File): Promise<{ text: string; mocked: boolean }> {
  const ext = getExtension(file.name) as AcceptedExtension

  if (ext === ".txt" || ext === ".md") {
    const text = await file.text()
    return { text, mocked: false }
  }

  if (ext === ".docx") {
    // DOCX is a ZIP of XML — full parsing requires a library (e.g. mammoth).
    // Returning mocked:true so the caller can warn the user.
    return { text: "", mocked: true }
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

// ─── Root component ────────────────────────────────────────────────────────────

type Step = "input" | "generating" | "document"

export function InterviewSummary() {
  const [step, setStep] = useState<Step>("input")
  // transcriptText is held in state for the server action but never rendered
  const [transcriptText, setTranscriptText] = useState("")
  const [notes, setNotes] = useState("")
  const [resume, setResume] = useState("")
  const [summary, setSummary] = useState<CandidateSummary | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleGenerate() {
    if (!transcriptText.trim()) return
    setStep("generating")
    try {
      const result = await generateQuestionnaire(transcriptText, notes, resume)
      setSummary(result)
      setStep("document")
    } catch {
      toast.error("Failed to generate questionnaire. Please try again.")
      setStep("input")
    }
  }

  function handleCopy() {
    if (!summary) return
    navigator.clipboard.writeText(summaryToPlainText(summary))
    toast.success("Copied to clipboard")
  }

  async function handleSave() {
    if (!summary) return
    setIsSaving(true)
    try {
      const { url } = await saveQuestionnaire(summary)
      toast.success("Saved to Google Docs", {
        description: "Click to open",
        action: { label: "Open", onClick: () => window.open(url, "_blank") },
        duration: 8000,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Failed to save to Google Docs", { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  if (step === "generating") {
    return <GeneratingState />
  }

  if (step === "document" && summary) {
    return (
      <DocumentView
        summary={summary}
        onSummaryChange={setSummary}
        onCopy={handleCopy}
        onSave={handleSave}
        isSaving={isSaving}
        onBack={() => setStep("input")}
      />
    )
  }

  return (
    <InputForm
      hasTranscript={transcriptText.trim().length > 0}
      notes={notes}
      resume={resume}
      onTranscriptLoad={setTranscriptText}
      onNotesChange={setNotes}
      onResumeChange={setResume}
      onGenerate={handleGenerate}
    />
  )
}

// ─── Input Form ────────────────────────────────────────────────────────────────

interface InputFormProps {
  hasTranscript: boolean
  notes: string
  resume: string
  onTranscriptLoad: (text: string) => void
  onNotesChange: (v: string) => void
  onResumeChange: (v: string) => void
  onGenerate: () => void
}

function InputForm({
  hasTranscript,
  notes,
  resume,
  onTranscriptLoad,
  onNotesChange,
  onResumeChange,
  onGenerate,
}: InputFormProps) {
  const [showOptional, setShowOptional] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const ext = getExtension(file.name)
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
      toast.error(`Unsupported file type "${ext}"`, {
        description: "Please upload a .txt, .md, or .docx file.",
      })
      return
    }

    try {
      const { text, mocked } = await extractTextFromFile(file)
      setUploadedFileName(file.name)

      if (mocked) {
        toast.warning("DOCX text extraction isn't supported yet", {
          description: "Please convert your file to .txt or .md and upload again.",
        })
        // Don't load empty text — keep whatever was loaded before
      } else {
        onTranscriptLoad(text)
        toast.success(`"${file.name}" loaded`)
      }
    } catch {
      toast.error("Could not read the file. Try a different format.")
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = "" // allow re-uploading the same file
  }

  function clearUpload() {
    setUploadedFileName(null)
    onTranscriptLoad("") // clear the transcript held by the parent
  }

  return (
    <div className="min-h-screen bg-muted/40 py-12">
      <div className="mx-auto max-w-2xl px-4">
        {/* Page header */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <FileText className="text-primary size-6" />
            <h1 className="text-2xl font-semibold">Screening Questionnaire Generator</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Generate a structured screening questionnaire from an interview transcript
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview Transcript</CardTitle>
            <CardDescription>
              Upload your transcript file to generate a screening questionnaire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ── File upload zone ── */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload transcript file"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
              )}
            >
              <Upload
                className={cn(
                  "size-5 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )}
              />
              <p className="text-sm">
                <span className="text-primary font-medium">Click to upload</span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </p>
              <p className="text-muted-foreground/70 text-xs">.txt · .md · .docx</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.docx"
              className="hidden"
              onChange={handleInputChange}
            />

            {/* Uploaded file badge */}
            {uploadedFileName && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                  hasTranscript ? "bg-primary/8" : "bg-muted/50"
                )}
              >
                <File
                  className={cn("size-4 shrink-0", hasTranscript ? "text-primary" : "text-muted-foreground")}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{uploadedFileName}</span>
                {hasTranscript && (
                  <span className="text-primary shrink-0 text-xs font-medium">Ready</span>
                )}
                <button
                  type="button"
                  onClick={clearUpload}
                  className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                  aria-label="Remove uploaded file"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Optional context fields */}
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
            >
              {showOptional ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              {showOptional ? "Hide" : "Add"} optional context
              <Badge variant="secondary" className="ml-0.5 text-xs">
                optional
              </Badge>
            </button>

            {showOptional && (
              <div className="space-y-4 pt-1">
                <div className="space-y-2">
                  <Label className="text-sm">Recruiter Notes</Label>
                  <Textarea
                    placeholder="Add any recruiter observations or internal notes..."
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    className="min-h-[100px] resize-y"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Candidate Resume</Label>
                  <Textarea
                    placeholder="Paste the candidate's resume text here..."
                    value={resume}
                    onChange={(e) => onResumeChange(e.target.value)}
                    className="min-h-[120px] resize-y"
                  />
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={onGenerate}
              disabled={!hasTranscript}
            >
              <Sparkles className="mr-2 size-4" />
              Generate Questionnaire
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Generating State ──────────────────────────────────────────────────────────

function GeneratingState() {
  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <Spinner className="text-primary mx-auto size-8" />
        <div>
          <p className="font-medium">Generating questionnaire...</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Analyzing the transcript and structuring the questionnaire
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Document View ─────────────────────────────────────────────────────────────

interface DocumentViewProps {
  summary: CandidateSummary
  onSummaryChange: (s: CandidateSummary) => void
  onCopy: () => void
  onSave: () => void
  isSaving: boolean
  onBack: () => void
}

function DocumentView({
  summary,
  onSummaryChange,
  onCopy,
  onSave,
  isSaving,
  onBack,
}: DocumentViewProps) {
  function updateHeader(key: keyof HeaderFields, value: string) {
    onSummaryChange({ ...summary, header: { ...summary.header, [key]: value } })
  }

  function updateQuestion(qi: number, value: string) {
    const qa = summary.qa.map((item, i) =>
      i === qi ? { ...item, question: value } : item
    )
    onSummaryChange({ ...summary, qa })
  }

  function updateBullet(qi: number, bi: number, value: string) {
    const qa = summary.qa.map((item, i) => {
      if (i !== qi) return item
      const bullets = item.bullets.map((b, j) => (j === bi ? value : b))
      return { ...item, bullets }
    })
    onSummaryChange({ ...summary, qa })
  }

  return (
    <div className="bg-muted/40 min-h-screen py-8">
      {/* Toolbar */}
      <div className="mx-auto mb-4 max-w-3xl px-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            New summary
          </button>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground mr-2 flex items-center gap-1 text-xs">
              <Pencil className="size-3" />
              Click any field to edit
            </div>
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="mr-2 size-4" />
              Copy
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              {isSaving ? (
                <Spinner className="mr-2 size-4" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {isSaving ? "Saving…" : "Save to Google Docs"}
            </Button>
          </div>
        </div>
      </div>

      {/* Document body */}
      <div className="mx-auto max-w-3xl px-4">
        <div className="dark:bg-card space-y-8 rounded-lg border bg-white p-8 shadow-sm">
          {/* ── Section 1: Header ── */}
          <div>
            <p className="text-muted-foreground mb-4 text-xs font-semibold uppercase tracking-wider">
              Candidate Information
            </p>
            <div className="space-y-1">
              {(Object.keys(HEADER_LABELS) as (keyof HeaderFields)[]).map((key) => (
                <div
                  key={key}
                  className="grid items-center gap-3 py-1"
                  style={{ gridTemplateColumns: "220px 1fr" }}
                >
                  <span className="text-muted-foreground text-sm font-medium">
                    {HEADER_LABELS[key]}
                  </span>
                  <input
                    value={summary.header[key]}
                    onChange={(e) => updateHeader(key, e.target.value)}
                    className="hover:border-border focus:border-primary w-full border-b border-transparent bg-transparent py-0.5 text-sm transition-colors outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Section 2: Q&A ── */}
          <div>
            <div className="space-y-7">
              {summary.qa.map((item, qi) => (
                <div key={qi} className="space-y-2">
                  {/* Question — textarea so long lines wrap */}
                  <textarea
                    value={item.question}
                    onChange={(e) => {
                      updateQuestion(qi, e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    rows={1}
                    className="hover:border-border focus:border-primary w-full min-w-0 resize-none overflow-hidden whitespace-normal break-words border-b border-transparent bg-transparent py-0.5 text-sm font-bold leading-snug transition-colors outline-none"
                  />
                  {/* Bullets */}
                  <div className="space-y-1.5 pl-1">
                    {item.bullets.map((bullet, bi) => (
                      <div key={bi} className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-1.5 shrink-0 text-xs leading-none">
                          •
                        </span>
                        <textarea
                          value={bullet}
                          onChange={(e) => {
                            updateBullet(qi, bi, e.target.value)
                            e.target.style.height = "auto"
                            e.target.style.height = e.target.scrollHeight + "px"
                          }}
                          rows={1}
                          className="hover:border-border focus:border-primary min-w-0 flex-1 resize-none overflow-hidden whitespace-normal break-words border-b border-transparent bg-transparent py-0.5 text-sm leading-snug transition-colors outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

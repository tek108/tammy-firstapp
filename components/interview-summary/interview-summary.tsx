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
  generateMockSummary,
  summaryToPlainText,
} from "@/lib/interview-summary"

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
    // DOCX is a ZIP of XML files — full parsing requires a library.
    // Returning a placeholder until mammoth/docx-parser is integrated.
    return { text: "", mocked: true }
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

// ─── Root component ────────────────────────────────────────────────────────────

type Step = "input" | "generating" | "document"

export function InterviewSummary() {
  const [step, setStep] = useState<Step>("input")
  const [transcript, setTranscript] = useState("")
  const [notes, setNotes] = useState("")
  const [resume, setResume] = useState("")
  const [summary, setSummary] = useState<CandidateSummary | null>(null)

  async function handleGenerate() {
    if (!transcript.trim()) return
    setStep("generating")
    try {
      const result = await generateMockSummary(transcript, notes, resume)
      setSummary(result)
      setStep("document")
    } catch {
      toast.error("Failed to generate summary. Please try again.")
      setStep("input")
    }
  }

  function handleCopy() {
    if (!summary) return
    navigator.clipboard.writeText(summaryToPlainText(summary))
    toast.success("Summary copied to clipboard")
  }

  function handleSave() {
    toast.info("Google Docs integration coming soon", {
      description: "Saving the questionnaire to Google Drive is planned for the next release.",
    })
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
        onBack={() => setStep("input")}
      />
    )
  }

  return (
    <InputForm
      transcript={transcript}
      notes={notes}
      resume={resume}
      onTranscriptChange={setTranscript}
      onNotesChange={setNotes}
      onResumeChange={setResume}
      onGenerate={handleGenerate}
    />
  )
}

// ─── Input Form ────────────────────────────────────────────────────────────────

interface InputFormProps {
  transcript: string
  notes: string
  resume: string
  onTranscriptChange: (v: string) => void
  onNotesChange: (v: string) => void
  onResumeChange: (v: string) => void
  onGenerate: () => void
}

function InputForm({
  transcript,
  notes,
  resume,
  onTranscriptChange,
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
        toast.warning("DOCX extraction isn't supported yet", {
          description: "Please paste the transcript text manually.",
        })
      } else {
        onTranscriptChange(text)
        toast.success(`"${file.name}" loaded`)
      }
    } catch {
      toast.error("Could not read the file. Try pasting the text manually.")
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear when leaving the zone itself, not child elements
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
    // Reset so re-uploading the same file triggers onChange again
    e.target.value = ""
  }

  function clearUpload() {
    setUploadedFileName(null)
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
            <CardDescription>Upload a file or paste the transcript to generate a screening questionnaire</CardDescription>
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
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
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
              <p className="text-muted-foreground/70 text-xs">.txt, .md, .docx</p>
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
              <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                <File className="text-primary size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">{uploadedFileName}</span>
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

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="border-border h-px flex-1 border-t" />
              <span className="text-muted-foreground/60 text-xs">or type below</span>
              <div className="border-border h-px flex-1 border-t" />
            </div>

            {/* Transcript textarea */}
            <Textarea
              placeholder="Paste the interview transcript here..."
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              className="min-h-[180px] resize-y"
            />

            {/* Optional fields toggle */}
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
              disabled={!transcript.trim()}
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
  onBack: () => void
}

function DocumentView({
  summary,
  onSummaryChange,
  onCopy,
  onSave,
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
            <Button size="sm" onClick={onSave}>
              <Save className="mr-2 size-4" />
              Save Questionnaire
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
            <p className="text-muted-foreground mb-5 text-xs font-semibold uppercase tracking-wider">
              Screening Questions &amp; Answers
            </p>
            <div className="space-y-7">
              {summary.qa.map((item, qi) => (
                <div key={qi} className="space-y-2">
                  {/* Question */}
                  <input
                    value={item.question}
                    onChange={(e) => updateQuestion(qi, e.target.value)}
                    className="hover:border-border focus:border-primary w-full border-b border-transparent bg-transparent py-0.5 text-sm font-bold transition-colors outline-none"
                  />
                  {/* Bullets */}
                  <div className="space-y-1.5 pl-1">
                    {item.bullets.map((bullet, bi) => (
                      <div key={bi} className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-1.5 shrink-0 text-xs leading-none">
                          •
                        </span>
                        <input
                          value={bullet}
                          onChange={(e) => updateBullet(qi, bi, e.target.value)}
                          className="hover:border-border focus:border-primary min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 text-sm transition-colors outline-none"
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

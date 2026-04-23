export interface HeaderFields {
  jobTitle: string
  name: string
  communication: string
  linkedin: string
  designation: string
  noticePeriod: string
  plannedVacations: string
  location: string
  workStatus: string
  salary: string
}

export interface QAItem {
  question: string
  bullets: string[]
}

export interface CandidateSummary {
  header: HeaderFields
  qa: QAItem[]
}

export const HEADER_LABELS: Record<keyof HeaderFields, string> = {
  jobTitle: "Job Title",
  name: "Name",
  communication: "Communication",
  linkedin: "LinkedIn",
  designation: "Designation",
  noticePeriod: "Notice Period / Availability",
  plannedVacations: "Planned Vacations",
  location: "Location",
  workStatus: "Work Status",
  salary: "Salary",
}

export function summaryToPlainText(summary: CandidateSummary): string {
  const lines: string[] = []

  lines.push("CANDIDATE SUMMARY")
  lines.push("=================")
  lines.push("")

  const headerEntries: [string, keyof HeaderFields][] = [
    ["Job Title", "jobTitle"],
    ["Name", "name"],
    ["Communication", "communication"],
    ["LinkedIn", "linkedin"],
    ["Designation", "designation"],
    ["Notice Period / Availability", "noticePeriod"],
    ["Planned Vacations", "plannedVacations"],
    ["Location", "location"],
    ["Work Status", "workStatus"],
    ["Salary", "salary"],
  ]

  for (const [label, key] of headerEntries) {
    lines.push(`${label}: ${summary.header[key]}`)
  }

  lines.push("")
  lines.push("QUESTIONS & ANSWERS")
  lines.push("===================")

  for (const item of summary.qa) {
    lines.push("")
    lines.push(item.question)
    for (const bullet of item.bullets) {
      lines.push(`• ${bullet}`)
    }
  }

  return lines.join("\n")
}

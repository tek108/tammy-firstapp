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

export async function generateMockSummary(
  _transcript: string,
  _notes?: string,
  _resume?: string
): Promise<CandidateSummary> {
  // Simulate AI processing time
  await new Promise((resolve) => setTimeout(resolve, 2500))

  return {
    header: {
      jobTitle: "Senior Frontend Engineer",
      name: "Alex Johnson",
      communication: "Excellent – articulate, confident, and concise throughout the interview",
      linkedin: "linkedin.com/in/alexjohnson",
      designation: "Senior Software Engineer at TechCorp",
      noticePeriod: "30 days",
      plannedVacations: "None in the next 3 months",
      location: "Tel Aviv, Israel (open to hybrid)",
      workStatus: "Employed, actively exploring new opportunities",
      salary: "35,000 ILS/month gross",
    },
    qa: [
      {
        question: "Can you walk me through your professional background and current role?",
        bullets: [
          "I have over 8 years of experience in frontend development, focusing on React and TypeScript ecosystems.",
          "Currently I lead a team of 4 engineers at TechCorp, shaping architecture for our flagship SaaS product.",
          "My background spans B2C and B2B domains, from early-stage fintech startups to large enterprise platforms.",
          "I led a full migration from a legacy Angular codebase to React, improving overall performance by 40 percent.",
          "I hold a B.Sc. in Computer Science from Tel Aviv University and two AWS Cloud certifications.",
        ],
      },
      {
        question: "What are your core technical strengths and areas of expertise?",
        bullets: [
          "I specialize in React, Next.js, and TypeScript with deep expertise in state management using Redux and Zustand.",
          "I have strong experience in performance optimization including code splitting, lazy loading, and bundle size analysis.",
          "I'm proficient with Jest, React Testing Library, and end-to-end testing workflows using Cypress and Playwright.",
          "I've worked extensively with GraphQL and REST APIs, including real-time features built on top of WebSockets.",
          "I have solid DevOps knowledge covering CI/CD pipelines with GitHub Actions and containerization using Docker.",
        ],
      },
      {
        question: "Why are you considering leaving your current position?",
        bullets: [
          "I've been in my current role for nearly 4 years and feel I've reached the ceiling of my growth potential.",
          "I'm seeking a more product-focused environment where I can have a broader influence on the user experience.",
          "The chance to work on greenfield projects and shape the technical direction from early stages excites me greatly.",
          "I'm looking for a culture that values innovation, fast iteration, and strong cross-functional team collaboration.",
        ],
      },
      {
        question: "How do you approach technical leadership and mentoring junior developers?",
        bullets: [
          "I lead by example by writing clean, well-documented code that sets a clear standard for the whole team.",
          "I hold weekly one-on-ones with my reports and give structured, actionable feedback during every code review.",
          "I established a frontend guild at TechCorp to share knowledge and best practices across teams biweekly.",
          "I encourage junior developers to own small features end-to-end to build their confidence and accountability.",
          "Three junior engineers I mentored are now mid-level contributors shipping features independently to production.",
        ],
      },
      {
        question: "What are your salary expectations and availability?",
        bullets: [
          "I'm currently earning 32,000 ILS gross and am looking for a meaningful step up to reflect my seniority.",
          "My target range is between 35,000 and 38,000 ILS gross per month, depending on the full role scope.",
          "I have a 30-day notice period at my current employer which I'll try to negotiate down if needed.",
          "I have no planned vacations in the next three months and can engage in the interview process immediately.",
        ],
      },
    ],
  }
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

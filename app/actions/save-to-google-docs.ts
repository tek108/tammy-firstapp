"use server"

import { saveQuestionnaireToGoogleDocs } from "@/lib/google/docs"
import type { CandidateSummary } from "@/lib/interview-summary"

export interface SaveResult {
  url: string
}

export async function saveQuestionnaire(
  summary: CandidateSummary
): Promise<SaveResult> {
  const url = await saveQuestionnaireToGoogleDocs(summary)
  return { url }
}

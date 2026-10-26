export type LeadType = "new_site" | "improvement" | "support" | "question" | "spam";
export type Urgency = "high" | "medium" | "low";

export type Contacts = {
  name: string;
  phones: string[];
  emails: string[];
  telegram: string[];
};

export type Triage = {
  type: LeadType;
  urgency: Urgency;
  urgency_reason: string;
  contacts: Contacts;
  budget: string;
  deadline: string;
  summary: string;
  missing: string[];
  reply_draft: string;
  notify: boolean;
};

export type Highlight = {
  start: number;
  end: number;
  kind: "phone" | "email" | "telegram" | "name";
};

export type TriageResponse = {
  triage: Triage;
  highlights: Highlight[];
  notes: string[];
  method: "ai" | "rules";
  elapsed_ms: number;
};

export type Limits = {
  max_lead_chars: number;
  triages_per_hour: number;
  triages_left: number;
};

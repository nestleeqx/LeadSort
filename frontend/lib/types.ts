export type LeadType = "new_site" | "improvement" | "support" | "question" | "spam";
export type Urgency = "high" | "medium" | "low";
export type Channel = "form" | "telegram" | "manual";
export type Column = "new" | "in_progress" | "waiting" | "closed" | "spam";
export type LeadState = "queued" | "running" | "done" | "error";

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

export type TriageField = Exclude<keyof Triage, "notify">;

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

export type Lead = {
  id: string;
  channel: Channel;
  status: Column;
  position: number;
  text: string;
  state: LeadState;
  error: string | null;
  triage: Triage | null;
  highlights: Highlight[];
  notes: string[];
  method: "ai" | "rules" | null;
  elapsed_ms: number | null;
  edited: TriageField[];
  demo_id: string | null;
  created_at: string;
};

export type LeadDetail = Lead & {
  events: { at: string; text: string }[];
};

export type Board = { leads: Lead[] };

export type Limits = {
  max_lead_chars: number;
  triages_per_hour: number;
  triages_left: number;
};

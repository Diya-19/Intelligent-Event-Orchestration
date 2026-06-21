export interface Event {
  id: string;
  name: string;
  format: string;
  current_stage: string;
  config: Record<string, unknown> | null;
  created_at: string;
  logo?: string;
}

export interface Participant {
  id: string;
  event_id: string;
  name: string;
  email: string;
  institution: string | null;
  skills: string[] | null;
  experience: string | null;
  created_at: string;
}

export interface DistributionRules {
  id: string;
  event_id: string;
  team_size: number;
  max_per_institution: number | null;
  required_skills: string[] | null;
  balance_by: string[] | null;
  exclusions: Record<string, unknown> | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  participant_id: string;
  role: "lead" | "member";
  participant?: Participant;
}

export interface Team {
  id: string;
  event_id: string;
  name: string;
  challenge: string | null;
  rationale: string | null;
  final_score: number | null;
  rank: number | null;
  status: "draft" | "approved" | "active" | "evaluated";
  created_at: string;
  members?: TeamMember[];
  balance_score?: number;
}

export interface PipelineStage {
  stage: string;
  status: "completed" | "active" | "pending";

}

export interface DashboardData {
    event: { name: string; current_stage: string };
  pipeline: PipelineStage[];
  pending_approvals: number;
  anomalies_open: number;
  evaluation_progress: { submitted: number; total: number };
  leaderboard_preview: Team[];

}
export interface ApprovalRequest {

id:string;

team_id:string;

requested_by:string;

type:string;

payload?:
Record<
string,
unknown
>;

status:

"pending"

|

"approved"

|

"rejected";

notes?:
string;

created_at:string;

}

export interface UploadResult {

loaded:number;

skipped:number;

errors:{

row:number;

reason:string;

}[];

}
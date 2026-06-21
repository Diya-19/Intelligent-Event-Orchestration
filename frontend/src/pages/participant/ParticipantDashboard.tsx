// src/pages/participant/ParticipantDashboard.tsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Flag,
  Clock,
  Calendar,
  FileText,
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  Check
} from "lucide-react";
import { participantService, DashboardResponse, SubmissionResponse, TeamDetailsResponse } from "../../lib/participantService";
import SubmissionStatusBadge from "../../components/SubmissionStatusBadge";

export default function ParticipantDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [teamDetails, setTeamDetails] = useState<TeamDetailsResponse | null>(null);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      participantService.getDashboard(),
      participantService.getTeamDetails(),
      participantService.getSubmission()
    ])
    .then(([dashRes, teamRes, subRes]) => {
      setData(dashRes);
      setTeamDetails(teamRes);
      setSubmission(subRes);
    })
    .catch((err) => setError(err.message || "Failed to load dashboard"))
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  if (!data) return null;

  // Calculate progress and deliverables
  let progress = 0;
  const completed: string[] = [];
  const pending: { name: string; param: string }[] = [];

  if (submission?.github_link) { progress += 25; completed.push("GitHub Repository"); } else { pending.push({ name: "GitHub Repository", param: "github" }); }
  if (submission?.project_description) { progress += 25; completed.push("Project Description"); } else { pending.push({ name: "Project Description", param: "description" }); }
  if (submission?.presentation_url) { progress += 25; completed.push("Presentation"); } else { pending.push({ name: "Presentation", param: "presentation" }); }
  if (submission?.demo_video_url) { progress += 25; completed.push("Demo Video"); } else { pending.push({ name: "Demo Video", param: "demo" }); }

  let statusText = "DRAFT";
  if (submission?.status) {
    statusText = submission.status;
  }

  return (
    <div className="p-6 bg-[#f8f6fc] min-h-screen">
      {/* Welcome Card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-6 mb-6">
        <div className="w-24 h-24 rounded-xl bg-purple-100 flex items-center justify-center text-5xl">
          📣
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to {data.event?.name || "HackFlow"}! 🎉
          </h1>

          <p className="text-gray-500 mt-2">
            You have been assigned to
          </p>

          <Link to="/participant/team" className="text-purple-600 font-semibold text-lg hover:underline">
            {data.team?.name || "No Team Assigned"}
          </Link>

          <p className="text-gray-500 text-sm mt-1">
            We are excited to have you on board, {data.participant?.name}!
          </p>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-800">
            Team Members
          </h2>

          <Link to="/participant/team" className="bg-purple-100 text-purple-600 px-4 py-2 rounded-full text-sm font-medium hover:bg-purple-200 transition">
            View Team
          </Link>
        </div>

        <div className="flex gap-10 flex-wrap">
          {teamDetails?.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users
                  size={18}
                  className="text-purple-600"
                />
              </div>

              <div>
                <p className="font-medium text-sm">
                  {member.name}
                </p>
                <p className="text-xs text-gray-500">
                  {member.skills?.[0] || "Member"}
                </p>
              </div>
            </div>
          ))}
          {(!teamDetails?.members || teamDetails.members.length === 0) && (
            <p className="text-sm text-gray-500">No team members found.</p>
          )}
        </div>
      </div>

      {/* Overview + Info */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Program Overview */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-purple-600 font-semibold mb-6">
            Program Overview
          </h2>

          <div className="space-y-5">
            <div className="flex gap-3">
              <Flag
                className="text-purple-400"
                size={18}
              />
              <div>
                <p className="text-xs text-gray-500">
                  Theme
                </p>
                <p className="text-sm font-medium">
                AI & ML
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <FileText
                className="text-purple-400"
                size={18}
              />
              <div>
                <p className="text-xs text-gray-500">
                  Current Stage
                </p>
                <p className="text-sm font-medium uppercase">
                  {data.event?.current_stage || "Pending"}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Clock
                className="text-purple-400"
                size={18}
              />
              <div>
                <p className="text-xs text-gray-500">
                  Duration
                </p>
                <p className="text-sm font-medium">
                  3 Weeks
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Calendar
                className="text-purple-400"
                size={18}
              />
              <div>
                <p className="text-xs text-gray-500">
                  Submission Deadline
                </p>
                <p className="text-sm font-medium">
                  Jun 28, 2026
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <ClipboardCheck
                className="text-purple-400"
                size={18}
              />
              <div>
                <p className="text-xs text-gray-500">
                  Evaluation Starts
                </p>
                <p className="text-sm font-medium">
                  July 5, 2026
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Your Info */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-purple-600 font-semibold mb-6">
              Your Info
            </h2>

            <div className="space-y-5 mb-6">
              <div className="flex gap-3">
                <Users
                  className="text-purple-400"
                  size={18}
                />
                <div>
                  <p className="text-xs text-gray-500">
                    Team
                  </p>
                  <p className="text-sm font-medium">
                    {data.team?.name || "Unassigned"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Calendar
                  className="text-purple-400"
                  size={18}
                />
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Submission Status
                  </p>
                  <SubmissionStatusBadge status={statusText} />
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">
                    Current Progress
                  </span>
                  <span className="font-medium">
                    {progress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-2 bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              {/* Pending Deliverables */}
              <div className="flex gap-3">
                <ClipboardCheck
                  className="text-purple-400 mt-0.5"
                  size={18}
                />
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Deliverables
                  </p>
                  <ul className="text-sm space-y-1">
                    {completed.map((p, idx) => (
                      <li key={`c-${idx}`} className="flex items-center gap-2 text-green-600">
                        <Check size={16} /> <span>{p}</span>
                      </li>
                    ))}
                    {pending.map((p, idx) => (
                      <li key={`p-${idx}`} className="flex items-center gap-2 text-orange-500">
                        <AlertTriangle size={16} /> 
                        <Link to={`/participant/submission?focus=${p.param}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Link to="/participant/submission" className="w-full mt-4 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-200 transition text-center block">
            {statusText === "SUBMITTED" ? "View Submission" : statusText === "READY" ? "Final Submit" : "Continue Submission"}
          </Link>
        </div>
      </div>
    </div>
  );
}
import { ArrowLeft, Download, Link, Globe } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { logActivity } from "../../lib/activityLogger";
import { getSubmissionByTeamId, ProjectSubmission } from "../../lib/submissionService";

export default function EvaluationPage() {
  const navigate = useNavigate();
  const { teamId } = useParams();

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any>({});
  const [rubric, setRubric] = useState<any>({
    Impact: 20,
    Execution: 20,
    Innovation: 20,
    Presentation: 20,
  });
  const [scores, setScores] = useState<any>({});
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("");
  const [submission, setSubmission] = useState<ProjectSubmission | null>(null);

  useEffect(() => {
    const fetchTeamDetail = async () => {
      try {
        const { data } = await api.get(`/api/judge/evaluations/${teamId}`);
        setTeam(data.team);
        setRubric(Object.keys(data.rubric || {}).length > 0 ? data.rubric : {
          Impact: 20,
          Execution: 20,
          Innovation: 20,
          Presentation: 20,
        });
        setScores(data.evaluation?.scores || {});
        setComments(data.evaluation?.comments || "");
        setStatus(data.status);
      } catch (err) {
        console.error("Failed to fetch team evaluation details", err);
      }
      
      if (teamId) {
        const sub = getSubmissionByTeamId(teamId);
        setSubmission(sub);
      }
      
      setLoading(false);
    };
    if (teamId) fetchTeamDetail();
  }, [teamId]);

  const handleScoreChange = (criteria: string, value: number) => {
    setScores((prev: any) => ({
      ...prev,
      [criteria]: value,
    }));
  };

  const handleSaveDraft = async () => {
    try {
      await api.put(`/api/judge/evaluations/${teamId}`, {
        scores,
        comments,
      });
      alert("Draft saved successfully!");
      setStatus("Draft");
      if (teamId) {
        logActivity('Draft Saved', team.name, teamId);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save draft");
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (Object.keys(rubric).length > 0) {
      for (const key of Object.keys(rubric)) {
        if (scores[key] === undefined || scores[key] === "") {
          alert(`Please provide a score for ${key.replace(/_/g, " ")} before submitting.`);
          return;
        }
        if (scores[key] < 0 || scores[key] > 10) {
          alert(`Score for ${key.replace(/_/g, " ")} must be between 0 and 10.`);
          return;
        }
      }
    }

    if (!window.confirm("Are you sure you want to submit? This action cannot be undone.")) return;
    try {
      await api.post(`/api/judge/evaluations/${teamId}/submit`, {
        scores,
        comments,
      });
      alert("Evaluation submitted successfully!");
      setStatus("Submitted");
      if (teamId) {
        logActivity('Evaluation Submitted', team.name, teamId);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to submit evaluation");
    }
  };

  const isReadOnly = status === "Submitted";

  // Calculate total from selected scores, normalized to 10
  let total = 0;
  if (Object.keys(rubric).length > 0) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const [key, weight] of Object.entries(rubric)) {
      weightedSum += (scores[key] || 0) * Number(weight);
      totalWeight += Number(weight);
    }
    total = totalWeight > 0 ? weightedSum / totalWeight : 0;
  } else {
    const scoreVals = Object.values(scores) as number[];
    if (scoreVals.length > 0) {
      total = scoreVals.reduce((a, b) => a + Number(b), 0) / scoreVals.length;
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading team details...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <button
        onClick={() => navigate("/judge/evaluations")}
        className="flex items-center gap-2 text-violet-600 font-medium mb-6"
      >
        <ArrowLeft size={18} />
        Back to My Evaluations
      </button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {team.name}
          </h1>

          <p className="text-gray-500 mt-2">
            {team.challenge}
          </p>
        </div>

        <div className="text-right">
          <p className="font-semibold">
            Round 1
          </p>
          <p className="text-gray-500">
            Team ID #{teamId?.substring(0, 8)}...
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left */}
        <div className="col-span-8 space-y-6">
          {/* Project Details */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold mb-4">
              Project Summary
            </h2>

            {submission ? (
              <div className="space-y-4">
                <p className="text-gray-800 font-medium">
                  {submission.projectName}
                </p>
                <p className="text-gray-600 leading-relaxed">
                  {submission.summary}
                </p>
                {submission.description && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">Description</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {submission.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 leading-relaxed italic">
                This team has not provided a project summary yet.
              </p>
            )}
          </div>

          {/* Links & Resources */}
          {submission && (submission.githubUrl || submission.demoUrl) && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold mb-4">
                Project Links
              </h2>
              <div className="flex flex-col gap-3">
                {submission.githubUrl && (
                  <a href={submission.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 w-full border rounded-lg p-3 hover:bg-gray-50 text-blue-600 transition-colors">
                    <Link size={18} />
                    View GitHub Repository
                  </a>
                )}
                {submission.demoUrl && (
                  <a href={submission.demoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 w-full border rounded-lg p-3 hover:bg-gray-50 text-emerald-600 transition-colors">
                    <Globe size={18} />
                    View Live Demo
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Deliverables */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold mb-4">
              Submitted Deliverables
            </h2>

            <div className="space-y-3">
              {!submission || submission.deliverables.length === 0 ? (
                <p className="text-gray-500 italic">No deliverables have been submitted.</p>
              ) : (
                submission.deliverables.map((d) => (
                  <a href={d.url} target="_blank" rel="noreferrer" key={d.id} className="flex items-center gap-3 w-full border rounded-lg p-3 hover:bg-gray-50 transition-colors text-gray-700">
                    <Download size={18} />
                    {d.title}
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Evaluation */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold mb-6">
              Evaluation Form {isReadOnly && "(Read Only)"}
            </h2>

            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">
                    Criteria
                  </th>
                  <th className="text-left py-3">
                    Weight
                  </th>
                  <th className="text-left py-3">
                    Score
                  </th>
                </tr>
              </thead>

              <tbody>
                {Object.keys(rubric).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-500">
                      No grading criteria configured for this event.
                    </td>
                  </tr>
                ) : (
                  Object.entries(rubric).map(([criteria, weight]: [string, any]) => (
                    <tr key={criteria}>
                      <td className="py-4 capitalize">
                        {criteria.replace(/_/g, " ")}
                      </td>
                      <td>{Number(weight)}%</td>
                      <td>
                        <select
                          className="border rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          value={scores[criteria] ?? ""}
                          onChange={(e) => handleScoreChange(criteria, Number(e.target.value))}
                          disabled={isReadOnly}
                        >
                          <option value="" disabled>Score</option>
                          {[...Array(11)].map((_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="mt-6 text-right">
              <span className="text-xl font-bold text-green-600">
                Total Score: {total.toFixed(2)} / 10
              </span>
            </div>
          </div>

          {/* Feedback */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold mb-4">
              Feedback
            </h2>

            <textarea
              rows={6}
              placeholder="Write your feedback..."
              className="w-full border rounded-lg p-4 disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={isReadOnly}
            />

            {!isReadOnly && (
              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={handleSaveDraft}
                  className="px-6 py-3 border rounded-lg hover:bg-gray-50"
                >
                  Save Draft
                </button>

                <button
                  onClick={handleSubmit}
                  className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  Submit Evaluation
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="col-span-4">
          <div className="bg-white rounded-xl border p-6 sticky top-6">
            <h2 className="text-xl font-semibold mb-4">
              Evaluation Criteria
            </h2>

            <div className="space-y-3 text-sm">
              {Object.keys(rubric).length === 0 ? (
                <p className="text-gray-500">None</p>
              ) : (
                Object.entries(rubric).map(([criteria, weight]: [string, any]) => (
                  <div key={criteria} className="flex justify-between">
                    <span className="capitalize">{criteria.replace(/_/g, " ")}</span>
                    <span>{Number(weight)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Mail, GraduationCap, ArrowLeft } from "lucide-react";
import { participantService, TeamDetailsResponse } from "../../lib/participantService";

export default function TeamPage() {
  const [data, setData] = useState<TeamDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    participantService.getTeamDetails()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load team details"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading team details...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  if (!data) return null;

  return (
    <div className="p-6 bg-[#f8f6fc] min-h-screen">
      <div className="mb-6">
        <Link 
          to="/participant" 
          className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-md py-1"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Team Information</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-2">{data.team.name}</h2>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Team Members</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 font-medium text-gray-500 text-sm">Name</th>
                    <th className="pb-3 font-medium text-gray-500 text-sm">Email</th>
                    <th className="pb-3 font-medium text-gray-500 text-sm">Institution</th>
                    <th className="pb-3 font-medium text-gray-500 text-sm">Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => (
                    <tr key={member.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <Users size={14} />
                          </div>
                          <span className="font-medium text-sm text-gray-900">{member.name}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail size={14} />
                          {member.email}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <GraduationCap size={14} />
                          {member.institution || "-"}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1">
                          {member.skills && member.skills.length > 0 ? (
                            member.skills.map((skill, i) => (
                              <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-purple-600 font-semibold mb-4">Assigned Track</h2>
            {data.track ? (
              <p className="font-medium text-gray-900">{data.track.name}</p>
            ) : (
              <p className="text-sm text-gray-500">AI & ML</p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-purple-600 font-semibold mb-4">Assigned Mentor</h2>
            {data.mentor ? (
              <p className="font-medium text-gray-900">{data.mentor.name}</p>
            ) : (
              <p className="text-sm text-gray-500">No mentor assigned</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  UserPlus,
  FileText,
  CheckSquare,
  Calendar,
  MoreVertical,
} from "lucide-react";
import { api } from "../../lib/api";

export default function CurrentEvent() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event_id") ?? "";
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get(`/api/dashboard/dashboard?event_id=${eventId}`);
        setDashboard(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [eventId]);
const stats = [
  {
    title: "Total Teams",
    value: dashboard?.total_teams ?? 0,
    change: "Teams Registered",
    icon: <Users size={22} />,
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "Registered Participants",
    value: dashboard?.registered_participants ?? 0,
    change: "Participants",
    icon: <UserPlus size={22} />,
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Submissions",
    value: dashboard?.submissions ?? 0,
    change: "Submissions Received",
    icon: <FileText size={22} />,
    color: "bg-red-100 text-red-600",
  },
  {
    title: "Evaluations Completed",
    value: dashboard?.evaluation_progress?.submitted ?? 0,
    change: `Out of ${dashboard?.evaluation_progress?.total ?? 0} Teams`,
    icon: <CheckSquare size={22} />,
    color: "bg-blue-100 text-blue-600",
  },
];
  const timeline = [
    {
      title: "Registration Opened",
      date: "Apr 20, 2025",
      status: "completed",
    },
    {
      title: "Team Formation Deadline",
      date: "May 10, 2025",
      status: "completed",
    },
    {
      title: "Round 2 Start",
      date: "May 18, 2025",
      status: "completed",
    },
    {
      title: "Submission Deadline",
      date: "May 31, 2025 11:59 PM",
      status: "active",
    },
    {
      title: "Evaluation",
      date: "Jun 1 - Jun 5, 2025",
      status: "pending",
    },
    {
      title: "Results Announcement",
      date: "Jun 10, 2025",
      status: "pending",
    },
  ];

  const tracks = [
    { name: "AI & ML", teams: 32, color: "bg-purple-100 text-purple-600" },
    { name: "Web & Mobile", teams: 28, color: "bg-blue-100 text-blue-600" },
    { name: "IoT", teams: 18, color: "bg-orange-100 text-orange-600" },
    { name: "Blockchain", teams: 12, color: "bg-green-100 text-green-600" },
    { name: "Other", teams: 8, color: "bg-gray-100 text-gray-600" },
  ];

  if (loading) {
  return (
    <div className="p-6">
      Loading dashboard...
    </div>
  );
}
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {dashboard?.event?.name || "Current Event"}
        </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {stats.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex justify-between items-center mb-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${item.color}`}
              >
                {item.icon}
              </div>
            </div>

            <p className="text-sm text-gray-500">{item.title}</p>

            <h2 className="text-3xl font-bold text-gray-800 mt-1">
              {item.value}
            </h2>

            <p className="text-sm text-green-600 mt-2">{item.change}</p>
          </div>
        ))}
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Calendar size={18} className="text-purple-600" />
              Event Timeline
            </h2>
          </div>

          <div className="space-y-5">
            {timeline.map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-4 h-4 rounded-full ${
                      item.status === "completed"
                        ? "bg-green-500"
                        : item.status === "active"
                        ? "bg-blue-500"
                        : "border-2 border-gray-400"
                    }`}
                  />

                  {index !== timeline.length - 1 && (
                    <div className="w-[2px] h-8 bg-gray-200 mt-1" />
                  )}
                </div>

                <div className="flex justify-between w-full">
                  <p className="text-sm font-medium text-gray-700">
                    {item.title}
                  </p>

                  <p className="text-xs text-gray-500">{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submission Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold text-gray-800">
              Submissions Overview
            </h2>
            <MoreVertical size={18} />
          </div>

          <div className="flex flex-col items-center">
            <div className="relative w-52 h-52">
              <svg
                className="w-full h-full rotate-[-90deg]"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="10"
                />

                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="10"
                  strokeDasharray="179 239"
                />

                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="10"
                  strokeDasharray="45 239"
                  strokeDashoffset="-179"
                />

                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="10"
                  strokeDasharray="15 239"
                  strokeDashoffset="-224"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <h3 className="text-4xl font-bold">
                  {dashboard?.submissions ?? 0}
                  </h3>
                <p className="text-sm text-gray-500">Total Submissions</p>
              </div>
            </div>

            <button className="mt-5 px-5 py-2 rounded-lg border text-purple-600 hover:bg-purple-50">
              View all submissions →
            </button>
          </div>
        </div>

        {/* Top Tracks */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-semibold text-gray-800">
              Top Tracks / Themes
            </h2>

            <MoreVertical size={18} />
          </div>

          <div className="space-y-5">
            {tracks.map((track, index) => (
              <div
                key={index}
                className="flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      track.color.split(" ")[0]
                    }`}
                  />

                  <span className="text-gray-700">{track.name}</span>
                </div>

                <span
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${track.color}`}
                >
                  {track.teams} teams
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
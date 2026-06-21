import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Trophy,
  Users,
  FileCheck,
  Calendar,
  Download,
  Share2,
  ArrowRight,
} from "lucide-react";
import { api, wsBase } from "../../lib/api";

// --- Types ---
type RankedTeam = {
  team_id: string;
  team_name: string;
  final_score: number;
  rank: number;
  prize?: string; // Optional field for future prize logic
};

export default function Results() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event_id") ?? "";

  // --- States ---
  const [rankedTeams, setRankedTeams] = useState<RankedTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Data Fetching ---
  const fetchLeaderboard = async () => {
    if (!eventId) return;
    setIsSyncing(true);
    try {
      const res = await api.get(`/api/events/${eventId}/scores/leaderboard`);
      setRankedTeams(res.data);
      setLastSynced(new Date());
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  // --- Real-time WebSocket Connection ---
  useEffect(() => {
    fetchLeaderboard();

    if (!eventId) return;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let pingInterval: ReturnType<typeof setInterval>;

    const connectWebSocket = () => {
      ws = new WebSocket(`${wsBase()}/ws/events/${eventId}/scoring`);

      ws.onopen = () => {
        console.log("Connected to live scoring stream!");
        
        // --- ADD HEARTBEAT ---
        // Send a tiny ping every 30 seconds to keep the proxy alive
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Listen for the specific consolidation event or general score updates
          if (data.event === "SCORES_CONSOLIDATED" || data.event === "SCORE_SUBMITTED") {
            fetchLeaderboard();
          }
        } catch (err) {
          console.error(err);
        }
      };

      ws.onclose = () => {
        console.log("Connection lost. Reconnecting...");
        clearInterval(pingInterval); // <-- Clear the heartbeat
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
        
      };
      
      ws.onerror = () => {
        ws.close(); 
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [eventId]);
  

  // --- Data Processing ---
  const topThree = rankedTeams.slice(0, 3);
  const restOfLeaderboard = rankedTeams.slice(3);

  // Helper for dynamic avatars based on team name
  const getAvatar = (name: string) => 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ede9fe&color=7c3aed&rounded=true&bold=true`;

  if (!eventId) return <div className="p-6 text-gray-500">Please select an event first.</div>;
  if (isLoading) return <div className="p-6 text-gray-500">Loading results...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-gray-900">Results</h1>
            {/* Live Sync Indicator */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-300 mt-1 ${isSyncing ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {isSyncing ? 'Updating...' : `Live • ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
          <p className="mt-2 text-gray-600">
            Explore winners, rankings and evaluation summary.
          </p>
        </div>

        <div className="bg-white border rounded-2xl px-6 py-5 shadow-sm flex items-center gap-4 w-full lg:w-[520px]">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
            <Trophy className="text-yellow-500" size={32} />
          </div>

          <div>
            <h3 className="font-semibold text-lg">
              Congratulations to all teams!
            </h3>
            <p className="text-gray-500 text-sm">
              Thank you for building the future with your ideas.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-10 mt-8 border-b">
        <button className="pb-4 border-b-2 border-violet-600 text-violet-600 font-medium">
          Leaderboard
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* LEFT */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {/* Top Teams */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold">Top Teams</h2>
            <p className="text-gray-500 text-sm mt-1">
              Top performing teams based on overall scores.
            </p>

            {rankedTeams.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl mt-6 border border-dashed">
                Waiting for scores to be consolidated...
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-5 mt-8">
                {/* 2nd Place */}
                {topThree[1] && (
                  <div className="relative border rounded-xl p-5 text-center mt-6">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-200 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">2</div>
                    <div className="w-16 h-16 mx-auto mb-4">
                        <img src={getAvatar(topThree[1].team_name)} alt={topThree[1].team_name} className="w-full h-full rounded-full object-cover border-2 border-gray-200 shadow-sm" />
                    </div>
                    <h3 className="font-semibold">{topThree[1].team_name}</h3>
                    <p className="text-3xl font-bold mt-3 text-gray-900">{topThree[1].final_score.toFixed(2)}<span className="text-sm text-gray-500 font-normal"> /100</span></p>
                    <span className="inline-block mt-4 px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-wide">1st Runner Up</span>
                  </div>
                )}

                {/* 1st Place / Winner */}
                {topThree[0] && (
                  <div className="relative border-2 border-yellow-300 bg-yellow-50/50 rounded-xl p-5 text-center shadow-sm">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">1</div>
                    <div className="w-20 h-20 mx-auto mb-4 relative">
                        <div className="absolute -top-3 -right-2 text-yellow-500 rotate-12"><Trophy size={24} fill="currentColor"/></div>
                        <img src={getAvatar(topThree[0].team_name)} alt={topThree[0].team_name} className="w-full h-full rounded-full object-cover border-4 border-yellow-300 shadow-sm" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{topThree[0].team_name}</h3>
                    <p className="text-4xl font-bold mt-2 text-gray-900">{topThree[0].final_score.toFixed(2)}<span className="text-sm text-gray-500 font-normal"> /100</span></p>
                    <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-bold uppercase tracking-wide">Winner</span>
                  </div>
                )}

                {/* 3rd Place */}
                {topThree[2] && (
                  <div className="relative border rounded-xl p-5 text-center mt-6">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-400 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">3</div>
                    <div className="w-16 h-16 mx-auto mb-4">
                        <img src={getAvatar(topThree[2].team_name)} alt={topThree[2].team_name} className="w-full h-full rounded-full object-cover border-2 border-orange-200 shadow-sm" />
                    </div>
                    <h3 className="font-semibold">{topThree[2].team_name}</h3>
                    <p className="text-3xl font-bold mt-3 text-gray-900">{topThree[2].final_score.toFixed(2)}<span className="text-sm text-gray-500 font-normal"> /100</span></p>
                    <span className="inline-block mt-4 px-3 py-1 rounded-lg bg-orange-50 text-orange-600 text-xs font-semibold uppercase tracking-wide">2nd Runner Up</span>
                  </div>
                )}
              </div>
            )}
            
            <button className="flex items-center gap-2 mx-auto mt-6 text-violet-600 font-medium hover:text-violet-700 transition">
              View Full Leaderboard <ArrowRight size={16} />
            </button>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Leaderboard</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b text-gray-500 uppercase tracking-wider text-xs">
                    <th className="pb-3 font-semibold">Rank</th>
                    <th className="pb-3 font-semibold">Team Name</th>
                    <th className="pb-3 font-semibold">Score</th>
                    <th className="pb-3 font-semibold text-right">Prize</th>
                  </tr>
                </thead>

                <tbody>
                  {restOfLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        {rankedTeams.length > 0 ? "No more teams to display." : "No leaderboard data available."}
                      </td>
                    </tr>
                  ) : (
                    restOfLeaderboard.map((team) => (
                      <tr key={team.team_id} className="border-b last:border-none hover:bg-gray-50 transition">
                        <td className="py-4 font-bold text-gray-500 px-2">{team.rank}</td>
                        <td className="py-4 font-semibold text-gray-900 flex items-center gap-3">
                          <img src={getAvatar(team.team_name)} alt="" className="w-6 h-6 rounded-full" />
                          {team.team_name}
                        </td>
                        <td className="py-4 font-medium text-gray-700">{team.final_score.toFixed(2)} <span className="text-xs text-gray-400">/100</span></td>
                        <td className="py-4 text-right font-medium text-gray-600">{team.prize || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT (Static placeholders preserved perfectly) */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Highlights */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Result Highlights</h2>
            <div className="space-y-5 text-gray-700">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3"><Users size={18} className="text-violet-500"/><span>Total Ranked Teams</span></div>
                <span className="font-bold text-gray-900">{rankedTeams.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3"><FileCheck size={18} className="text-violet-500"/><span>Submissions Evaluated</span></div>
                <span className="font-bold text-gray-900">100%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3"><Trophy size={18} className="text-violet-500"/><span>Winners Announced</span></div>
                <span className="font-bold text-gray-900">{topThree.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3"><Calendar size={18} className="text-violet-500"/><span>Last Updated</span></div>
                <span className="font-bold text-gray-900">{lastSynced.toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Downloads */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold">Download Results</h2>
            <div className="grid grid-cols-2 gap-4 mt-5">
              <button className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition group">
                <div className="text-left">
                  <h4 className="font-semibold text-gray-800 text-sm">Results PDF</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Full rankings</p>
                </div>
                <Download size={18} className="text-gray-400 group-hover:text-violet-600 transition" />
              </button>
              <button className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition group">
                <div className="text-left">
                  <h4 className="font-semibold text-gray-800 text-sm">Certificates</h4>
                  <p className="text-xs text-gray-500 mt-0.5">For all participants</p>
                </div>
                <Download size={18} className="text-gray-400 group-hover:text-violet-600 transition" />
              </button>
            </div>
          </div>

          {/* Share */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-semibold">Share Results</h2>
            <p className="text-sm text-gray-500 mt-1">Celebrate the achievements.</p>
            <div className="flex gap-3 mt-5">
              <button className="w-10 h-10 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition flex items-center justify-center text-gray-600 shadow-sm">
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
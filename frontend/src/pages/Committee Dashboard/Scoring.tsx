import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, AlertTriangle, Users, ClipboardCheck, Trophy, Star, Eye, CheckCircle } from "lucide-react";
import { api, wsBase } from "../../lib/api";

type Evaluation = {
  evaluator_id: string;
  overall: number | null;
  scores: Record<string, number>;
  submitted_at: string | null;
};

type TeamScoreData = {
  team_id: string;
  team_name: string;
  challenge: string | null;
  evaluations: Evaluation[];
  final_score: number | null;
  rank: number | null;
};

type Anomaly = {
  id: string;
  evaluation_id: string;
  team_id: string | null;
  team_name: string;
  dimension: string;
  flagged_score: number;
  panel_average: number;
  deviation: number;
  status: string;
  resolution: string | null;
  created_at: string;
};

export default function Scoring() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event_id") ?? "";

  const [search, setSearch] = useState("");
  const [teams, setTeams] = useState<TeamScoreData[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamScoreData | null>(null);
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchScoringData = async () => {
    if (!eventId) return;
    setIsSyncing(true);
    try {
      const [teamsRes, anomaliesRes] = await Promise.all([
        api.get(`/api/events/${eventId}/scores/`),
        api.get(`/api/events/${eventId}/scores/anomalies`)
      ]);
      setTeams(teamsRes.data);
      setAnomalies(anomaliesRes.data);
      setLastSynced(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  useEffect(() => {
    fetchScoringData();

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
          if (data.event === "EVALUATOR_ADDED" || data.event === "SCORE_SUBMITTED" || data.event === "SCORES_CONSOLIDATED") {
            fetchScoringData(); 
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

  const handleConsolidate = async () => {
    try {
      await api.post(`/api/events/${eventId}/scores/consolidate`);
      fetchScoringData();
    } catch (err: any) {
      alert(err.response?.data?.detail);
    }
  };

  const handleResolveAnomaly = async (anomalyId: string, action: string, overrideVal?: number) => {
    try {
      await api.post(`/api/events/${eventId}/scores/anomalies/${anomalyId}/resolve`, {
        action,
        override_value: overrideVal
      });
      fetchScoringData(); 
    } catch (err: any) {
      alert("Failed to resolve anomaly.");
    }
  };

  const getCalculatedAverage = (team: TeamScoreData) => {
    if (team.final_score !== null) return team.final_score.toFixed(2);
    if (team.evaluations.length === 0) return "0.00";
    
    const validScores = team.evaluations.map(e => e.overall).filter((s): s is number => s !== null);
    if (validScores.length === 0) return "0.00";
    
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    return (sum / validScores.length).toFixed(2);
  };

  const filteredTeams = useMemo(() => {
    const filtered = teams.filter(
      (team) => 
        team.team_name.toLowerCase().includes(search.toLowerCase()) ||
        (team.challenge && team.challenge.toLowerCase().includes(search.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      const scoreA = Number(getCalculatedAverage(a));
      const scoreB = Number(getCalculatedAverage(b));
      return scoreB - scoreA;
    });
  }, [search, teams]);

  const totalTeams = teams.length;
  const evaluatedTeams = teams.filter((t) => t.evaluations.some(e => e.overall !== null)).length;
  
  const validAverages = teams
    .map(t => Number(getCalculatedAverage(t)))
    .filter(n => n > 0);
    
  const averageScore = validAverages.length > 0 
    ? (validAverages.reduce((acc, val) => acc + val, 0) / validAverages.length).toFixed(2) 
    : "0.00";
    
  const highestScore = validAverages.length > 0 
    ? Math.max(...validAverages).toFixed(2) 
    : "0.00";

  const pendingAnomaliesCount = anomalies.filter(a => a.status === "pending").length;

  if (!eventId) return <div className="p-6 text-gray-500">Please select an event first.</div>;
  if (isLoading) return <div className="p-6 text-gray-500">Loading scoring data...</div>;

  const maxPanels = Math.max(...teams.map(t => t.evaluations.length), 1);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">Scoring Dashboard</h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-300 ${isSyncing ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {isSyncing ? 'Syncing...' : `Live • ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
          <p className="text-gray-500 mt-1">Evaluate teams and identify scoring anomalies.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConsolidate}
            disabled={pendingAnomaliesCount > 0}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={pendingAnomaliesCount > 0 ? "Resolve anomalies first" : ""}
          >
            <CheckCircle size={18} />
            Consolidate Scores
          </button>
          
          <button
            onClick={() => setShowAnomalyModal(true)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
          >
            <AlertTriangle size={18} />
            Anomalies
            {pendingAnomaliesCount > 0 && (
              <span className="bg-white text-red-600 text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                {pendingAnomaliesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <StatCard icon={<Users size={20} />} title="Total Teams" value={totalTeams} />
        <StatCard icon={<ClipboardCheck size={20} />} title="Evaluated Teams" value={evaluatedTeams} />
        <StatCard icon={<Star size={20} />} title="Average Score" value={averageScore} />
        <StatCard icon={<Trophy size={20} />} title="Highest Score" value={highestScore} />
        <StatCard 
          icon={<AlertTriangle size={20} className={pendingAnomaliesCount > 0 ? "text-red-500" : ""} />} 
          title="Pending Anomalies" 
          value={pendingAnomaliesCount} 
        />
      </div>

      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search teams or projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-lg pl-10 pr-4 py-2"
            />
          </div>
          <button className="border rounded-lg px-4 flex items-center gap-2">
            <Filter size={18} /> Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Team Scores</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-gray-600">Rank</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-600">Team</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-600">Project</th>
                
                {Array.from({ length: maxPanels }).map((_, i) => (
                  <th key={i} className="text-left p-4 text-sm font-semibold text-gray-600">Panel {i + 1}</th>
                ))}
                
                <th className="text-left p-4 text-sm font-semibold text-gray-600">Average</th>
                <th className="text-right p-4 text-sm font-semibold text-gray-600">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTeams.map((team, index) => (
                <tr key={team.team_id} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">
                    #{index + 1}
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-gray-900">{team.team_name}</p>
                      <p className="text-xs text-gray-500">{team.team_id.split('-')[0]}</p>
                    </div>
                  </td>
                  
                  <td className="p-4 text-gray-700">
                    {team.challenge ? team.challenge : <span className="text-gray-400 italic">Unassigned</span>}
                  </td>

                  {Array.from({ length: maxPanels }).map((_, i) => {
                    const evalData = team.evaluations[i];
                    return (
                      <td key={i} className="p-4 text-gray-700 font-medium">
                        {evalData?.overall ? evalData.overall.toFixed(1) : "-"}
                      </td>
                    );
                  })}

                  <td className="p-4 font-bold text-violet-700">
                    {getCalculatedAverage(team)}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedTeam(team)}
                      className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 text-sm font-medium bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition"
                    >
                      <Eye size={16} /> View Breakdown
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTeams.length === 0 && (
                <tr>
                  <td colSpan={5 + maxPanels} className="p-8 text-center text-gray-500">
                    No teams found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTeam && (
        <ScoreDrawer
          team={selectedTeam}
          average={getCalculatedAverage(selectedTeam)}
          onClose={() => setSelectedTeam(null)}
        />
      )}

      {showAnomalyModal && (
        <AnomalyModal
          anomalies={anomalies}
          onResolve={handleResolveAnomaly}
          onClose={() => setShowAnomalyModal(false)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm">
      <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold mt-1 text-gray-900">{value}</h3>
    </div>
  );
}

function ScoreDrawer({ team, average, onClose }: { team: TeamScoreData; average: string; onClose: () => void; }) {
  
  const aggregatedCriteria: Record<string, { sum: number, count: number }> = {};
  
  team.evaluations.forEach(ev => {
    if (!ev.scores) return;
    Object.entries(ev.scores).forEach(([key, val]) => {
      if (!aggregatedCriteria[key]) {
        aggregatedCriteria[key] = { sum: 0, count: 0 };
      }
      aggregatedCriteria[key].sum += val;
      aggregatedCriteria[key].count += 1;
    });
  });

  const criteriaList = Object.entries(aggregatedCriteria).map(([name, data]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    avg: (data.sum / data.count).toFixed(1)
  }));

  return (
    <div className="fixed inset-0 z-50">
      <div onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="absolute right-0 top-0 h-full w-[420px] bg-white shadow-xl border-l overflow-y-auto">
        
        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Score Breakdown</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl font-bold">✕</button>
        </div>

        <div className="p-5">
          <div className="bg-violet-50 rounded-xl p-5 mb-6 border border-violet-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-xl text-violet-900">{team.team_name}</h3>
              </div>
            </div>
            
            {team.challenge && (
              <div className="mt-3 inline-block bg-white border border-violet-200 px-3 py-1.5 rounded-md shadow-sm">
                <p className="text-xs text-violet-600 font-semibold uppercase tracking-wide mb-0.5">Project</p>
                <p className="text-sm font-medium text-gray-800">{team.challenge}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-violet-200/60">
              <div>
                <p className="text-xs uppercase tracking-wider text-violet-600 font-semibold">Average Score</p>
                <h3 className="text-3xl font-bold text-violet-900 mt-1">{average}</h3>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-violet-600 font-semibold">Rank</p>
                <h3 className="text-3xl font-bold text-violet-900 mt-1">{team.rank ? `#${team.rank}` : "-"}</h3>
              </div>
            </div>
          </div>

          <h4 className="font-semibold text-gray-800 mb-4">Criteria Breakdown</h4>
          <div className="space-y-4 mb-8">
            {criteriaList.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200">No criteria data available yet.</p>
            ) : (
              criteriaList.map((item) => (
                <div key={item.name} className="border rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    <span className="text-sm font-bold text-gray-900">{item.avg} / 10</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-violet-500 h-full rounded-full transition-all"
                      style={{ width: `${(Number(item.avg) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <h4 className="font-semibold text-gray-800 mb-4">Panel Scores</h4>
          <div className="space-y-3">
            {team.evaluations.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200">No evaluations submitted yet.</p>
            ) : (
              team.evaluations.map((ev, i) => (
                <PanelScore
                  key={ev.evaluator_id || i.toString()}
                  panel={`Panel ${i + 1}`}
                  score={ev.overall}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelScore({ panel, score }: { panel: string; score: number | null }) {
  const displayScore = score ? score.toFixed(1) : "0";
  return (
    <div className="border rounded-lg p-3 bg-gray-50 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{panel}</span>
        <span className="font-bold text-gray-900">{displayScore}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full"
          style={{ width: `${(Number(displayScore) / 100) * 100}%` }}
        />
      </div>
    </div>
  );
}

function AnomalyModal({ 
  anomalies, 
  onResolve, 
  onClose 
}: { 
  anomalies: Anomaly[]; 
  onResolve: (id: string, action: string, val?: number) => void;
  onClose: () => void; 
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="text-red-500" /> Scoring Anomalies
            </h2>
            <p className="text-gray-500 text-sm mt-1">Review and resolve potential scoring inconsistencies.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 transition text-2xl leading-none">✕</button>
        </div>

        <div className="p-6 overflow-auto flex-1">
          {anomalies.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No anomalies found</h3>
              <p className="text-gray-500 mt-1">All scoring looks consistent across the panels.</p>
            </div>
          ) : (
            <table className="w-full whitespace-nowrap">
              <thead className="bg-gray-100 rounded-t-lg">
                <tr>
                  <th className="text-left p-3 text-xs uppercase font-bold text-gray-500">Team</th>
                  <th className="text-left p-3 text-xs uppercase font-bold text-gray-500">Dimension</th>
                  <th className="text-left p-3 text-xs uppercase font-bold text-gray-500">Flagged Score</th>
                  <th className="text-left p-3 text-xs uppercase font-bold text-gray-500">Panel Avg</th>
                  <th className="text-left p-3 text-xs uppercase font-bold text-gray-500">Deviation</th>
                  <th className="text-left p-3 text-xs uppercase font-bold text-gray-500">Severity</th>
                  <th className="text-left p-3 text-xs uppercase font-bold text-gray-500">Status</th>
                  <th className="text-right p-3 text-xs uppercase font-bold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((item) => {
                  const absDeviation = Math.abs(item.deviation);
                  const severity = absDeviation > 4 ? "High" : absDeviation > 2 ? "Medium" : "Low";
                  return (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{item.team_name}</td>
                      <td className="p-3 font-medium capitalize text-gray-900">{item.dimension}</td>
                      <td className="p-3 text-red-600 font-bold">{item.flagged_score}</td>
                      <td className="p-3 text-gray-600">{item.panel_average}</td>
                      <td className="p-3 font-mono text-gray-600">
                        {item.deviation > 0 ? "+" : ""}{item.deviation}
                      </td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          severity === "High" ? "bg-red-100 text-red-700" :
                          severity === "Medium" ? "bg-orange-100 text-orange-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {severity}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          item.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {item.status === "pending" ? (
                          <>
                            <button 
                              onClick={() => onResolve(item.id, "keep")}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded transition shadow-sm border border-gray-200"
                            >
                              Keep Score
                            </button>
                            <button 
                              onClick={() => {
                                const val = prompt(`Override score for ${item.dimension}? Current: ${item.flagged_score}, Panel Avg: ${item.panel_average}`);
                                if (val && !isNaN(Number(val))) {
                                  onResolve(item.id, "override", Number(val));
                                }
                              }}
                              className="text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded transition font-medium shadow-sm"
                            >
                              Override...
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Resolved: {item.resolution}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
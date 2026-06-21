import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Hourglass, 
  Calendar, 
  ChevronRight, 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Megaphone,
  Sparkles,
  BarChart3,
  Save,
  PlayCircle,
  Clock,
  CheckCircle,
  X,
  Eye,
  Edit,
  User,
  LogOut,
  AlertTriangle,
  AlertCircle,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearJudgeToken } from '../../lib/auth';
import { getActivities, logActivity, mergeApiActivities, formatRelativeTime, ActivityItem } from '../../lib/activityLogger';
import { getUpcomingDeadlines, getRemainingTime, Deadline } from '../../lib/deadlineService';
import { getAssignedTeams, mergeAssignmentStatus, calculateEvaluationMetrics } from '../../lib/teamAssignmentService';

const TeamListModal = ({ isOpen, onClose, title, teams, onTeamClick, type, navigate }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="pb-3 font-semibold">Team Name</th>
                <th className="pb-3 font-semibold">Project</th>
                {type === 'completed' && <th className="pb-3 font-semibold">Submitted</th>}
                <th className="pb-3 font-semibold">Status</th>
                {type === 'draft' || type === 'completed' || type === 'assigned' ? <th className="pb-3 font-semibold">Score</th> : null}
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No teams found.</td></tr>}
              {teams.map((team: any) => (
                <tr key={team.teamId || team.team_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4">
                    <div
                      onClick={() => {
                        if (team.status === 'not_started' || team.status === 'draft') {
                          logActivity('Evaluation Started', team.teamName, team.teamId);
                          navigate(`/judge/evaluation/${team.teamId}`);
                        } else {
                          onTeamClick(team.teamId);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (team.status === 'not_started' || team.status === 'draft') {
                            logActivity('Evaluation Started', team.teamName, team.teamId);
                            navigate(`/judge/evaluation/${team.teamId}`);
                          } else {
                            onTeamClick(team.teamId);
                          }
                        }
                      }}
                      tabIndex={0}
                      className="group flex items-center gap-3 cursor-pointer focus:outline-none"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                        <Users className="w-4 h-4 text-slate-500 group-hover:text-purple-600 transition-colors" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 group-hover:text-blue-600 group-hover:underline transition-colors">
                          {team.teamName || team.team_name}
                        </div>
                        <div className="text-xs text-slate-400 hidden sm:block mt-0.5 font-mono">
                          {team.teamId ? team.teamId.substring(0, 8) : team.team_id ? team.team_id.substring(0, 8) : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-slate-500">{team.trackName || team.challenge}</td>
                  {type === 'completed' && <td className="py-4 text-slate-500">{team.submittedAt ? new Date(team.submittedAt).toLocaleDateString() : 'N/A'}</td>}
                  <td className="py-4 text-slate-500">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                      team.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : 
                      team.status === 'draft' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {team.status === 'not_started' ? 'Not Started' :
                       team.status === 'draft' ? 'Draft' :
                       team.status === 'submitted' ? 'Submitted' : 'In Progress'}
                    </span>
                  </td>
                  {type === 'draft' || type === 'completed' || type === 'assigned' ? (
                    <td className="py-4 font-medium text-slate-700">{team.overallScore !== null ? Number(team.overallScore).toFixed(2) : '-'}</td>
                  ) : null}
                  <td className="py-4 text-right">
                    {team.status === 'not_started' || team.status === 'draft' ? (
                      <button onClick={() => { logActivity('Started/Continued evaluation', team.teamName || team.team_name, team.teamId || team.team_id); navigate(`/judge/evaluation/${team.teamId || team.team_id}`); }} className="text-blue-600 font-semibold text-xs border border-blue-100 bg-white px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center gap-1">
                        {team.status === 'draft' ? 'Continue' : 'Evaluate'} <ChevronRight className="w-3 h-3" />
                      </button>
                    ) : (
                      <button onClick={() => onTeamClick(team.teamId || team.team_id)} className="text-slate-600 font-semibold text-xs border border-slate-200 bg-white px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1">
                        View Details <ChevronRight className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const TeamDetailsModal = ({ isOpen, onClose, teamId }: any) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && teamId) {
      setLoading(true);
      api.get(`/api/judge/evaluations/${teamId}`).then(res => {
        setDetails(res.data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [isOpen, teamId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Team Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-slate-500 py-8">Loading details...</p>
          ) : details ? (
            <div className="space-y-6 text-sm">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{details.team.name}</h3>
                <p className="text-slate-500 mt-1">{details.team.challenge}</p>
                <div className="mt-3 flex gap-4">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium">Status: {details.status}</span>
                  {details.evaluation?.overall > 0 && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium">Score: {Number(details.evaluation.overall).toFixed(2)}</span>}
                </div>
              </div>
              
              <div>
                <h4 className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-wider border-b pb-2">Participants</h4>
                {details.team.participants && details.team.participants.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {details.team.participants.map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="font-semibold text-slate-800">{p.name} <span className="text-xs font-normal text-slate-400">({p.role})</span></p>
                        <p className="text-slate-500 text-xs mt-1">{p.email}</p>
                        {p.institution && <p className="text-slate-500 text-xs mt-1">{p.institution}</p>}
                        {p.skills && p.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.skills.map((s: string, j: number) => <span key={j} className="text-[10px] bg-white border px-1.5 py-0.5 rounded text-slate-500">{s}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No participants found.</p>
                )}
              </div>

              {details.status === "Submitted" && (
                <div>
                  <h4 className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-wider border-b pb-2">Evaluation Summary</h4>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="grid grid-cols-2 gap-y-2 mb-4">
                      {Object.entries(details.evaluation.scores || {}).map(([crit, val]: any) => (
                        <div key={crit} className="flex justify-between max-w-[200px]">
                          <span className="capitalize text-slate-600">{crit.replace(/_/g, ' ')}</span>
                          <span className="font-semibold">{val as number}/10</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-semibold">Feedback:</span>
                      <p className="text-slate-700 mt-1 italic">"{details.evaluation.comments || 'No comments'}"</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-red-500">Failed to load team details.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ProgressModal = ({ isOpen, onClose, evaluations, navigate, onTeamClick }: any) => {
  if (!isOpen) return null;
  const completed = evaluations.filter((e:any) => e.status === "Submitted");
  const drafts = evaluations.filter((e:any) => e.status === "Draft");
  const pending = evaluations.filter((e:any) => e.status === "Not Started");

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Detailed Progress Report</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-8">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Completed ({completed.length})</h3>
            {completed.length === 0 ? <p className="text-slate-500 text-sm">No completed evaluations.</p> : (
              <div className="grid gap-3">
                {completed.map((e:any) => (
                  <div key={e.team_id} onClick={() => onTeamClick(e.team_id)} className="p-4 bg-slate-50 border rounded-xl cursor-pointer hover:border-purple-300">
                    <p className="font-bold text-slate-800">{e.team_name}</p>
                    <p className="text-sm text-slate-500">Score: {Number(e.overall_score).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Drafts ({drafts.length})</h3>
            {drafts.length === 0 ? <p className="text-slate-500 text-sm">No drafts saved.</p> : (
              <div className="grid gap-3">
                {drafts.map((e:any) => (
                  <div key={e.team_id || e.teamId} onClick={() => { logActivity('Evaluation Started', e.team_name || e.teamName, e.team_id || e.teamId); navigate(`/judge/evaluation/${e.team_id || e.teamId}`); }} className="p-4 bg-orange-50 border border-orange-100 rounded-xl cursor-pointer hover:border-orange-300">
                    <p className="font-bold text-slate-800">{e.team_name || e.teamName}</p>
                    <p className="text-sm text-slate-500">Current Score: {e.overall_score || e.overallScore ? Number(e.overall_score || e.overallScore).toFixed(2) : '0.00'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Pending ({pending.length})</h3>
            {pending.length === 0 ? <p className="text-slate-500 text-sm">No pending evaluations.</p> : (
              <div className="grid gap-3">
                {pending.map((e:any) => (
                  <div key={e.team_id} onClick={() => { logActivity('Started/Continued evaluation', e.team_name, e.team_id); navigate(`/judge/evaluation/${e.team_id}`); }} className="p-4 bg-slate-50 border rounded-xl cursor-pointer hover:border-purple-300">
                    <p className="font-bold text-slate-800">{e.team_name}</p>
                    <p className="text-sm text-slate-500">{e.challenge}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityModal = ({ isOpen, onClose, activities }: any) => {
  const [filter, setFilter] = useState('All');
  if (!isOpen) return null;

  const getActivityIcon = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('submit')) return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' };
    if (lower.includes('draft') || lower.includes('save')) return { icon: Save, color: 'text-orange-600', bg: 'bg-orange-100' };
    if (lower.includes('continu')) return { icon: Edit, color: 'text-blue-600', bg: 'bg-blue-100' };
    if (lower.includes('start')) return { icon: PlayCircle, color: 'text-purple-600', bg: 'bg-purple-100' };
    if (lower.includes('view')) return { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100' };
    return { icon: Megaphone, color: 'text-slate-600', bg: 'bg-slate-100' };
  };

  const filtered = activities.filter((act: any) => {
    if (filter === 'All') return true;
    return act.activity.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">All Activity</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-4 border-b border-slate-100 flex gap-2 overflow-x-auto">
          {['All', 'Submitted', 'Draft Saved', 'Started', 'Continued'].map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filter === f ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto p-6 space-y-3">
          {filtered.length === 0 ? (
             <p className="text-center text-slate-500 py-8">No evaluation activity yet.</p>
          ) : (
            filtered.map((act: any, idx: number) => {
              const { icon: Icon, color, bg } = getActivityIcon(act.activity);
              return (
                <div key={idx} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex items-start gap-4 hover:bg-slate-50 transition-colors">
                  <div className={`p-2 rounded-lg mt-0.5 ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-800 text-sm">{act.team_name}</h3>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap pt-0.5">{act.timestamp || formatRelativeTime(act.time)}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-600 mt-1">{act.activity}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// Simple SVG mini sparkline chart generator component to match the top cards
const MiniSparkline = ({ color }: { color: string }) => (
  <svg className="w-full h-8 mt-4" viewBox="0 0 100 20" preserveAspectRatio="none">
    <path
      d="M0,15 Q15,5 30,12 T60,8 T90,14 L100,10"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(location.state?.openNotifications || false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const [evaluationsList, setEvaluationsList] = useState<any[]>([]);
  const [realActivity, setRealActivity] = useState<ActivityItem[]>([]);
  const [modalType, setModalType] = useState<'assigned' | 'completed' | 'pending' | 'draft' | 'progress' | 'activity' | null>(location.state?.openActivity ? 'activity' : null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [judgeProfile, setJudgeProfile] = useState({ name: "", email: "", organization: "", avatar: "" });

  useEffect(() => {
    const updateActivity = () => {
      if (evaluationsList.length > 0) {
        setRealActivity(mergeApiActivities(evaluationsList));
      } else {
        setRealActivity(getActivities());
      }
    };
    window.addEventListener("activity_logged", updateActivity);
    return () => window.removeEventListener("activity_logged", updateActivity);
  }, [evaluationsList]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const [dashboardData, setDashboardData] = useState({
    assigned_teams: 0,
    completed_evaluations: 0,
    pending_evaluations: 0,
    progress_percentage: 0,
    recent_activity: [],
    upcoming_deadlines: []
  });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, evalRes, profileRes] = await Promise.all([
          api.get('/api/judge/dashboard'),
          api.get('/api/judge/evaluations'),
          api.get('/api/judge/profile'),
        ]);
        setDashboardData(dashRes.data);
        setEvaluationsList(evalRes.data);
        setRealActivity(mergeApiActivities(evalRes.data));
        // Merge backend data with any locally saved avatar
        const savedProfile = localStorage.getItem('judge_profile');
        const localAvatar = savedProfile ? JSON.parse(savedProfile).avatar : "";
        setJudgeProfile({
          name: profileRes.data.name || "",
          email: profileRes.data.email || "",
          organization: profileRes.data.organization || "",
          avatar: localAvatar,
        });
        setError(null);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-8">
        <p className="text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-8">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const {
    assigned_teams,
    completed_evaluations,
    pending_evaluations,
    progress_percentage,
    recent_activity,
    upcoming_deadlines
  } = dashboardData;

  const assignments = getAssignedTeams();
  const mergedTeams = mergeAssignmentStatus(assignments, evaluationsList);

  // Single source of truth for counts
  const { assignedCount: totalAssigned, completedCount, draftCount: draftsCount, pendingCount } = calculateEvaluationMetrics(mergedTeams);
  const progressPercent = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  const topStats = [
    { id: 'assigned', title: 'Assigned Teams', value: totalAssigned.toString(), trend: 'Current event', trendType: 'neutral', icon: Users, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', strokeColor: '#8B5CF6' },
    { id: 'completed', title: 'Evaluations Completed', value: completedCount.toString(), trend: 'Evaluated', trendType: 'up', icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', strokeColor: '#10B981' },
    { id: 'pending', title: 'Pending Evaluations', value: pendingCount.toString(), trend: 'To do', trendType: 'down', icon: Hourglass, iconBg: 'bg-orange-50', iconColor: 'text-orange-600', strokeColor: '#F97316' },
    { id: 'draft', title: 'In Progress Teams', value: draftsCount.toString(), trend: 'Draft saved', trendType: 'neutral', icon: Calendar, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', strokeColor: '#3B82F6' },
  ];

  const assignedTeams = mergedTeams.map((t: any) => ({
    id: t.teamId.substring(0,8),
    name: t.teamName,
    track: t.trackName,
    date: 'Recent',
    evalCount: t.status === 'submitted' ? '1/1' : '0/1',
    progress: t.status === 'submitted' ? 100 : t.status === 'draft' ? 50 : 0,
    statusDisplay: t.status === 'submitted' ? 'Submitted' : t.status === 'draft' ? 'Draft' : 'Not Started',
    status: t.status,
    statusColor: t.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : t.status === 'draft' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700',
    original: t
  }));

  const deadlines = getUpcomingDeadlines();

  const dashboardActivities = realActivity.slice(0, 5);

  const getActivityIcon = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('submit')) return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' };
    if (lower.includes('draft') || lower.includes('save')) return { icon: Save, color: 'text-orange-600', bg: 'bg-orange-100' };
    if (lower.includes('continu')) return { icon: Edit, color: 'text-blue-600', bg: 'bg-blue-100' };
    if (lower.includes('start')) return { icon: PlayCircle, color: 'text-purple-600', bg: 'bg-purple-100' };
    if (lower.includes('view')) return { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100' };
    return { icon: Megaphone, color: 'text-slate-600', bg: 'bg-slate-100' };
  };

  const getNotificationDetails = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('submit')) return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' };
    if (lowerTitle.includes('draft') || lowerTitle.includes('save')) return { icon: Save, color: 'text-orange-600', bg: 'bg-orange-50' };
    if (lowerTitle.includes('start') || lowerTitle.includes('evaluat')) return { icon: PlayCircle, color: 'text-blue-600', bg: 'bg-blue-50' };
    if (lowerTitle.includes('deadline')) return { icon: Clock, color: 'text-red-600', bg: 'bg-red-50' };
    return { icon: Bell, color: 'text-purple-600', bg: 'bg-purple-50' };
  };

  const getModalFilteredTeams = () => {
    if (modalType === 'assigned') return mergedTeams;
    if (modalType === 'completed') return mergedTeams.filter((e: any) => e.status === 'submitted');
    if (modalType === 'pending') return mergedTeams.filter((e: any) => e.status === 'not_started');
    if (modalType === 'draft') return mergedTeams.filter((e: any) => e.status === 'draft');
    return [];
  };

  const modalTitles: any = {
    assigned: 'All Assigned Teams',
    completed: 'Completed Evaluations',
    pending: 'Pending Evaluations',
    draft: 'In Progress Teams'
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased p-4 md:p-6 lg:p-8">
      {['assigned', 'completed', 'pending', 'draft'].includes(modalType as string) && (
        <TeamListModal 
          isOpen={true} 
          onClose={() => setModalType(null)} 
          title={modalTitles[modalType as string]} 
          teams={getModalFilteredTeams()} 
          onTeamClick={(id: string) => setSelectedTeamId(id)} 
          type={modalType} 
          navigate={navigate} 
        />
      )}
      {modalType === 'progress' && (
        <ProgressModal 
          isOpen={true} 
          onClose={() => setModalType(null)} 
          evaluations={evaluationsList} 
          navigate={navigate}
          onTeamClick={(id: string) => setSelectedTeamId(id)}
        />
      )}
      <ActivityModal
        isOpen={modalType === 'activity'}
        onClose={() => setModalType(null)}
        activities={recent_activity}
      />
      <TeamDetailsModal 
        isOpen={!!selectedTeamId} 
        onClose={() => setSelectedTeamId(null)} 
        teamId={selectedTeamId} 
      />
      {/* HEADER SECTION */}
      <div className="w-full flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Welcome back, <span className="text-slate-900">{judgeProfile.name || "Judge"}</span> 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">Here's an overview of your evaluation tasks.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative" ref={notificationRef}>
            <div 
              className="p-2 bg-white rounded-full border border-slate-100 shadow-sm cursor-pointer"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {recent_activity.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {recent_activity.length}
                </span>
              )}
            </div>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Notifications</h3>
                  <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-md">{recent_activity.length} New</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {recent_activity.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">No new notifications</div>
                  ) : (
                    recent_activity.map((activity: any, idx: number) => {
                      const { icon: Icon, color, bg } = getNotificationDetails(activity.title);
                      return (
                        <div key={idx} className="p-4 border-b border-slate-50 hover:bg-slate-50/50 flex gap-3 items-start transition-colors cursor-pointer">
                          <div className={`p-2 rounded-lg ${bg}`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{activity.title}</p>
                            {activity.subtitle && <p className="text-xs text-slate-500 mt-0.5">{activity.subtitle}</p>}
                            <p className="text-[10px] font-medium text-slate-400 mt-1">{activity.time}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={profileRef}>
            <div 
              className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-slate-100 transition-colors"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              {judgeProfile.avatar ? (
                <img
                  src={judgeProfile.avatar}
                  alt={judgeProfile.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold text-sm border border-slate-200">
                  {judgeProfile.name ? judgeProfile.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : "J"}
                </div>
              )}
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-[-90deg]' : 'rotate-90'}`} />
            </div>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden py-1">
                <button 
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/judge/profile');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  My Profile
                </button>
                <button 
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowNotifications(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Bell className="w-4 h-4 text-slate-400" />
                  Notifications
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button 
                  onClick={() => {
                    clearJudgeToken();
                    navigate('/login');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full space-y-6">
        
        {/* TOP STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {topStats.map((stat) => (
            <div 
              key={stat.id} 
              onClick={() => setModalType(stat.id as any)}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between cursor-pointer hover:border-purple-200 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide">{stat.title}</span>
                  <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
                </div>
                <div className={`${stat.iconBg} p-2.5 rounded-xl`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {stat.trendType === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                  {stat.trendType === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  {stat.trendType === 'neutral' && <Minus className="w-3.5 h-3.5 text-blue-500" />}
                  <span className={
                    stat.trendType === 'up' ? 'text-emerald-600' : 
                    stat.trendType === 'down' ? 'text-red-600' : 'text-blue-600'
                  }>
                    {stat.trend}
                  </span>
                </div>
                <MiniSparkline color={stat.strokeColor} />
              </div>
            </div>
          ))}
        </div>

        {/* MIDDLE SECTION: ASSIGNED TEAMS & EVALUATION PROGRESS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* ASSIGNED TEAMS TABLE */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-5">Assigned Teams</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      <th className="pb-3 pl-2">Team</th>
                      <th className="pb-3">Project / Track</th>
                      <th className="pb-3">Assigned On</th>
                      <th className="pb-3">Evaluations</th>
                      <th className="pb-3">Progress</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                    {assignedTeams.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No teams assigned yet or data unavailable.
                        </td>
                      </tr>
                    ) : (
                      assignedTeams.slice(0, 5).map((team, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 pl-2">
                            <div 
                              onClick={() => {
                                if (team.status === 'not_started' || team.status === 'draft') {
                                  logActivity('Evaluation Started', team.name, team.original.teamId);
                                  navigate(`/judge/evaluation/${team.original.teamId}`);
                                } else {
                                  setSelectedTeamId(team.original.teamId);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (team.status === 'not_started' || team.status === 'draft') {
                                    logActivity('Evaluation Started', team.name, team.original.teamId);
                                    navigate(`/judge/evaluation/${team.original.teamId}`);
                                  } else {
                                    setSelectedTeamId(team.original.teamId);
                                  }
                                }
                              }}
                              tabIndex={0}
                              className="group flex items-center gap-4 cursor-pointer focus:outline-none"
                            >
                              <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-purple-200 transition-colors">
                                {team.name.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 group-hover:underline transition-colors whitespace-nowrap">
                                  {team.name}
                                </div>
                                <div className="text-xs text-slate-400 font-mono mt-0.5 hidden sm:block">
                                  ID: {team.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 text-slate-500 whitespace-nowrap">{team.track}</td>
                          <td className="py-3.5 text-slate-500 whitespace-nowrap">{team.date}</td>
                          <td className="py-3.5 font-medium text-slate-800">{team.evalCount}</td>
                          <td className="py-3.5 w-24">
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  team.progress > 50 ? 'bg-purple-600' : team.progress === 50 ? 'bg-emerald-500' : 'bg-orange-500'
                                }`} 
                                style={{ width: `${team.progress}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${team.statusColor}`}>
                              {team.statusDisplay}
                            </span>
                          </td>
                          <td className="py-3.5 text-center">
                            {team.status === 'not_started' || team.status === 'draft' ? (
                              <button 
                                onClick={() => {
                                  logActivity('Evaluation Started', team.name, team.original.teamId);
                                  navigate(`/judge/evaluation/${team.original.teamId}`);
                                }} 
                                className="text-blue-600 font-semibold hover:underline flex items-center gap-0.5 mx-auto"
                              >
                                {team.status === 'draft' ? 'Continue' : 'Evaluate'} <ChevronRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <button onClick={() => setSelectedTeamId(team.original.teamId)} className="text-slate-600 font-semibold hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-md bg-white hover:bg-slate-50 flex items-center gap-0.5 mx-auto shadow-sm">
                                View <ChevronRight className="w-3 h-3 text-slate-400" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {assignedTeams.length > 5 && (
              <button onClick={() => setModalType('assigned')} className="mt-5 text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1 w-full pt-4 border-t border-slate-50">
                View all assigned teams <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* EVALUATION PROGRESS DONUT */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-6">Evaluation Progress</h2>
              
              <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-6 my-2">
                {/* SVG Donut Chart */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F1F5F9" strokeWidth="3" />
                    <circle 
                      cx="18" 
                      cy="18" 
                      r="15.915" 
                      fill="none" 
                      stroke="#8B5CF6" 
                      strokeWidth="3" 
                      strokeDasharray={`${progressPercent} ${100 - progressPercent}`} 
                      strokeDashoffset="0"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-2xl font-bold text-slate-800 block">{progressPercent}%</span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Overall Progress</span>
                  </div>
                </div>

                {/* Legend list metrics */}
                <div className="flex-1 w-full space-y-3 text-xs">
                  <p className="text-slate-500 font-medium mb-1 text-center sm:text-left lg:text-center">
                    You've completed <span className="font-bold text-slate-700">{completedCount} out of {totalAssigned}</span> evaluations.
                  </p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      <span className="text-slate-600 font-medium">Completed</span>
                    </div>
                    <span className="font-semibold text-slate-800">{completedCount} <span className="text-slate-400 font-normal">({totalAssigned ? Math.round((completedCount/totalAssigned)*100) : 0}%)</span></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                      <span className="text-slate-600 font-medium">Pending</span>
                    </div>
                    <span className="font-semibold text-slate-800">{pendingCount} <span className="text-slate-400 font-normal">({totalAssigned ? Math.round((pendingCount/totalAssigned)*100) : 0}%)</span></span>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setModalType('progress')} className="mt-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-xl py-2.5 px-4 text-xs flex items-center justify-center gap-2 transition-colors w-full">
              <BarChart3 className="w-4 h-4" />
              <span>View detailed report</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto" />
            </button>
          </div>

        </div>

        {/* BOTTOM SECTION: UPCOMING DEADLINES & ANNOUNCEMENTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* UPCOMING DEADLINES */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-base font-bold text-slate-900">Upcoming Deadlines</h2>
                <button 
                  onClick={() => navigate('/judge/deadlines')}
                  className="text-xs font-bold text-purple-600 hover:underline"
                >
                  View all
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-4 lg:hidden">
                 {/* This grid dynamically shifts, but since we are doing custom slicing we can just do CSS hiding or slicing in JS. The easiest responsive approach with JS array slicing is trickier because we need different counts per breakpoint. Let's rely on CSS hiding of nth elements instead. */}
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 snap-x">
                {deadlines.length === 0 ? (
                  <p className="text-sm text-slate-500 col-span-full">No upcoming deadlines.</p>
                ) : (
                  deadlines.map((deadline: Deadline, idx: number) => {
                    
                    const isExpired = deadline.status === "expired" || new Date(deadline.dueDate).getTime() < Date.now();
                    const priority = deadline.priority || 'low';
                    
                    let priorityStyle = 'bg-blue-50 border-blue-100 text-blue-700';
                    let Icon = Calendar;
                    if (isExpired) {
                      priorityStyle = 'bg-red-50 border-red-100 text-red-700';
                      Icon = AlertCircle;
                    }
                    else if (priority === 'critical') {
                      priorityStyle = 'bg-rose-50 border-rose-100 text-rose-700';
                      Icon = AlertTriangle;
                    }
                    else if (priority === 'high') {
                      priorityStyle = 'bg-orange-50 border-orange-100 text-orange-700';
                      Icon = AlertTriangle;
                    }
                    else if (priority === 'medium') {
                      priorityStyle = 'bg-amber-50 border-amber-100 text-amber-700';
                      Icon = Clock;
                    }

                    // Only show first 4 items desktop, 3 tablet, 2 mobile.
                    // We use responsive hide classes based on idx.
                    const displayClass = idx >= 4 ? 'hidden' : 
                                         idx >= 3 ? 'hidden xl:flex lg:hidden' : 
                                         idx >= 2 ? 'hidden md:flex xl:flex' : 
                                         'flex flex-col min-w-[240px] sm:min-w-0';

                    return (
                      <div 
                        key={deadline.id} 
                        onClick={() => navigate('/judge/deadlines')}
                        className={`gap-2 p-4 rounded-xl border ${priorityStyle} cursor-pointer hover:shadow-md transition-all snap-start ${displayClass}`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <h4 className="text-sm font-bold leading-tight">{deadline.title}</h4>
                            <div className="text-xs font-medium opacity-80 mt-1">
                              {new Date(deadline.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(deadline.dueDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                            <div className="text-xs font-bold mt-2 pt-2 border-t border-current/20">
                              {getRemainingTime(deadline)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
              </div>

              <div className="space-y-4">
                {dashboardActivities.length === 0 ? (
                  <p className="text-sm text-slate-500">No evaluation activity yet.</p>
                ) : (
                  dashboardActivities.map((act: ActivityItem) => {
                    const { icon: Icon, color, bg } = getActivityIcon(act.action);
                    return (
                      <div key={act.id} className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 ${bg}`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">{act.action}</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              {act.action === "Evaluation Submitted" || act.action === "Draft Saved" || act.action === "Evaluation Started" 
                                ? `${act.action.split(' ')[0]} ${act.action.split(' ')[1]} for ${act.teamName}`
                                : act.teamName}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap pt-1">
                          {formatRelativeTime(act.timestamp)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button onClick={() => setModalType('activity')} className="mt-5 text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1 w-full pt-4 border-t border-slate-50">
              View all activity <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
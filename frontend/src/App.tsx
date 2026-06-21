import React, { useState, useEffect } from "react";
import { api } from "./lib/api";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import TeamPage from "./pages/participant/TeamPage";

// Committee Dashboard Pages
import DashboardLayout from "./pages/Committee Dashboard/Sidebar";
import OverviewPage from "./pages/Committee Dashboard/Dashboard";
import ParticipantsPage from "./pages/Committee Dashboard/ParticipantsPage";
import TeamFormation from "./pages/Committee Dashboard/TeamFormation";
import RulesPage from "./pages/Committee Dashboard/Rules";
import CurrentEvent from "./pages/Committee Dashboard/CurrentEvent";
import Communication from "./pages/Committee Dashboard/Communication";
import Scoring from "./pages/Committee Dashboard/Scoring";
import Results from "./pages/Committee Dashboard/Results";
import JudgeManagement from "./pages/Committee Dashboard/JudgeManagement";
import ActivityLogs from "./pages/Committee Dashboard/ActivityLogs";
import TravelManagement from "./pages/Committee Dashboard/TravelManagement";
import TravelAndLogistics from "./pages/Committee Dashboard/Travel&Logistics";

// Judge Pages
import JudgeSidebar from "./pages/Judge/sidebar";
import JudgeDashboard from "./pages/Judge/dashboard";
import MyEvaluation from "./pages/Judge/Evaluation";
import EvaluationPage from "./pages/Judge/EvaluationPage";
import JudgeDeadlines from "./pages/Judge/Deadlines";
import JudgeProfile from "./pages/Judge/Profile";

// Participant Pages
import ParticipantSidebar from "./pages/participant/sidebar";
import ParticipantChat from "./pages/participant/chat";
import SubmissionPage from "./pages/participant/submission";
import HelpPage from "./pages/participant/help"; 
import ParticipantDashboard from "./pages/participant/ParticipantDashboard";

// Travel Pages
import TravelDashboard from "./pages/travel/Dashboard";
import TravelNotifications from "./pages/travel/Notifications";
import TravelQueries from "./pages/travel/TravelQueries";

// TEMP AUTH BYPASS
function RequireAuth({ children }: { children: JSX.Element }) {
  return children;
}

function RequireRound3({ children }: { children: JSX.Element }) {
  const [isQualified, setIsQualified] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchQualification = async () => {
      try {
        const res = await api.get("/api/participant/dashboard");
        if (res.data?.team?.is_qualified_round_3) {
          setIsQualified(true);
        } else {
          setIsQualified(false);
        }
      } catch (err) {
        setIsQualified(false);
      }
    };
    fetchQualification();
  }, []);

  if (isQualified === null) return <div>Loading...</div>;
  if (!isQualified) return <Navigate to="/participant" replace />;
  return children;
}

// JUDGE AUTH (With DEV_MODE Support)
function RequireJudgeAuth({ children }: { children: JSX.Element }) {
  const isDev = import.meta.env.VITE_DEV_MODE === "true";
  // const isDev = false;
   console.log("DEV MODE =", import.meta.env.VITE_DEV_MODE, "isDev =", isDev);
  
  if (isDev) {
    return children;
  }
  
  const token = localStorage.getItem("evaluator_token");
  if (!token) {
    // If no token exists, they shouldn't access the judge pages. 
    // Redirecting to login as fallback, or show unauthorized.
    return <Navigate to="/login" replace />; 
  }
  
  return children;
}

// PARTICIPANT AUTH (With DEV_MODE Support)
function RequireParticipantAuth({ children }: { children: JSX.Element }) {
  const isDev = import.meta.env.VITE_DEV_MODE === "true";
  if (isDev) {
    return children;
  }
  const token = localStorage.getItem("participant_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={<LoginPage />} />

        {/* COMMITTEE DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="participants" element={<ParticipantsPage />} />
          <Route path="team-formation" element={<TeamFormation />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="current-event" element={<CurrentEvent />} />
          <Route path="communication" element={<Communication />} />
          <Route path="scoring" element={<Scoring />} />
          <Route path="results" element={<Results />} />
          <Route path="judge-management" element={<JudgeManagement />} />
          <Route path="activity-logs" element={<ActivityLogs />} />
          <Route path="travel-management" element={<TravelManagement />} />
          <Route path="travel-logistics" element={<TravelAndLogistics />}/>
        </Route>

        {/* JUDGE DASHBOARD */}
        <Route
          path="/judge"
          element={
            <RequireAuth>
              <div className="flex min-h-screen bg-gray-50">
                <JudgeSidebar />
                <div className="flex-1 overflow-y-auto">
                  <Outlet />
                </div>
              </div>
            </RequireAuth>
          }
        >
          <Route index element={<JudgeDashboard />} />
          <Route path="evaluations" element={<MyEvaluation />} />
          <Route path="evaluation/:teamId" element={<EvaluationPage />} />
          <Route path="deadlines" element={<JudgeDeadlines />} />
          <Route path="profile" element={<JudgeProfile />} />
        </Route>

        {/* PARTICIPANT DASHBOARD */}
        <Route
          path="/participant"
          element={
            <RequireAuth>
              <div className="flex min-h-screen bg-gray-50">
                <ParticipantSidebar />
                <div className="flex-1 overflow-y-auto">
                  <Outlet />
                </div>
              </div>
            </RequireAuth>
          }
        >
          <Route index element={<ParticipantDashboard />} />
          <Route path="chat" element={<ParticipantChat />} />
          <Route path="submission" element={<SubmissionPage />} />
          <Route path="support" element={<HelpPage />} />
          <Route path="team" element={<TeamPage />} />
          
          {/* TRAVEL ROUTES */}
          <Route element={<RequireRound3><Outlet /></RequireRound3>}>
            <Route path="travel" element={<TravelDashboard />} />
            <Route path="notifications" element={<TravelNotifications />} />
            <Route path="travel-queries" element={<TravelQueries />} />
          </Route>
        </Route>
          

        {/* DEFAULT REDIRECT */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
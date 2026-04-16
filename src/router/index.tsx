import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/doctor/DashboardPage";
import RecordDetailPage from "../pages/doctor/RecordDetailPage";
import RecordSubmitPage from "../pages/patient/RecordSubmitPage";
import SurveyPage from "../pages/patient/SurveyPage";
import SurveyDonePage from "../pages/patient/SurveyDonePage";

// 준비 중 placeholder
const PlaceholderPage = ({ title }: { title: string }) => (
  <div style={{ padding: "2rem", textAlign: "center", fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>
    <h2>{title}</h2>
    <p style={{ color: "#8c8c8c", marginTop: 8 }}>준비 중입니다.</p>
  </div>
);

// 로그인 필요 라우트 보호
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  // ── 의사 ──────────────────────────────────────────────────
  {
    path: "/doctor",
    element: <PrivateRoute><DashboardPage /></PrivateRoute>,
  },
  {
    path: "/doctor/record",
    element: <PrivateRoute><RecordDetailPage /></PrivateRoute>,
  },
  {
    path: "/doctor/common-questions",
    element: <PrivateRoute><PlaceholderPage title="공통 질문" /></PrivateRoute>,
  },
  {
    path: "/doctor/ai-questions",
    element: <PrivateRoute><PlaceholderPage title="AI 맞춤 질문" /></PrivateRoute>,
  },
  // ── 환자 ──────────────────────────────────────────────────
  {
    path: "/patient",
    element: <Navigate to="/patient/record" replace />,
  },
  {
    path: "/patient/record",
    element: <PrivateRoute><RecordSubmitPage /></PrivateRoute>,
  },
  {
    path: "/patient/survey",
    element: <PrivateRoute><SurveyPage /></PrivateRoute>,
  },
  {
    path: "/patient/survey/done",
    element: <PrivateRoute><SurveyDonePage /></PrivateRoute>,
  },
]);

export default router;

import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DoctorRegisterPage from "../pages/auth/DoctorRegisterPage";
import PatientRegisterPage from "../pages/auth/PatientRegisterPage";
import { DoctorLayout } from "../pages/doctor/Layout";
import DashboardPage from "../pages/doctor/DashboardPage";
import RecordDetailPage from "../pages/doctor/RecordDetailPage";
import PatientRecordsPage from "../pages/doctor/PatientRecordsPage";
import CommonQPage from "../pages/doctor/CommonQPage";
import AIReviewPage from "../pages/doctor/AIReviewPage";
import RecordListPage from "../pages/patient/RecordListPage";
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
  // ── 회원가입 ───────────────────────────────────────────────────
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/register/doctor",
    element: <DoctorRegisterPage />,
  },
  {
    path: "/register/patient",
    element: <PatientRegisterPage />,
  },
  // ── 의사 ──────────────────────────────────────────────────
  {
    path: "/doctor",
    element: <PrivateRoute><DoctorLayout><DashboardPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/record",
    element: <PrivateRoute><DoctorLayout><RecordDetailPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/patients/:patientId",
    element: <PrivateRoute><DoctorLayout><PatientRecordsPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/common-questions",
    element: <PrivateRoute><DoctorLayout><CommonQPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/ai-questions",
    element: <PrivateRoute><DoctorLayout><AIReviewPage /></DoctorLayout></PrivateRoute>,
  },
  // ── 환자 ──────────────────────────────────────────────────
  {
    path: "/patient",
    element: <PrivateRoute><RecordListPage /></PrivateRoute>,
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

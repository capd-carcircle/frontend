import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import useAuthStore from "../store/authStore";
import LoginPage from "../pages/auth/LoginPage";
import DoctorRegisterPage from "../pages/auth/DoctorRegisterPage";
import PatientRegisterPage from "../pages/auth/PatientRegisterPage";
import { DoctorLayout } from "../pages/doctor/Layout";
import DashboardPage from "../pages/doctor/DashboardPage";
import RecordDetailPage from "../pages/doctor/RecordDetailPage";
import PatientRecordsPage from "../pages/doctor/PatientRecordsPage";
import PatientAnalyticsPage from "../pages/doctor/PatientAnalyticsPage";
import PatientListPage from "../pages/doctor/PatientListPage";
import CommonQPage from "../pages/doctor/CommonQPage";
import AIReviewPage from "../pages/doctor/AIReviewPage";
import PatientApprovalPage from "../pages/doctor/PatientApprovalPage";
import RecordListPage from "../pages/patient/RecordListPage";
import RecordSubmitPage from "../pages/patient/RecordSubmitPage";
import CommonSurveyPage from "../pages/patient/CommonSurveyPage";
import AiSurveyPage from "../pages/patient/AiSurveyPage";
import SurveyDonePage from "../pages/patient/SurveyDonePage";
import PatientMyPage from "../pages/patient/PatientMyPage";
import DoctorMyPage from "../pages/doctor/DoctorMyPage";

// 로딩 스피너 (hydration 대기용)
function AuthLoading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--capd-bg)', fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: 'var(--capd-primary)' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>세션 확인 중...</div>
      </div>
    </div>
  )
}

// 로그인 필요 라우트 보호 + role 검증
function PrivateRoute({ children, role }: { children: React.ReactNode; role?: 'doctor' | 'patient' }) {
  const isHydrated = useAuthStore(s => s.isHydrated)
  if (!isHydrated) return <AuthLoading />

  const token = localStorage.getItem("access_token")
  const userRole = localStorage.getItem("user_role")
  if (!token) return <Navigate to="/login" replace />;
  if (role && userRole !== role) return <Navigate to="/login" replace />;
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
  // ── 회원가입 (로그인 화면에서 역할별 가입으로 직행 — /register 역할선택 페이지는 미사용으로 제거) ──
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
    element: <PrivateRoute role="doctor"><DoctorLayout><DashboardPage /></DoctorLayout></PrivateRoute>,
  },
  {
    // recordId를 URL에 포함 — 새로고침·북마크·공유 가능 (state는 보조)
    path: "/doctor/records/:recordId",
    element: <PrivateRoute role="doctor"><DoctorLayout><RecordDetailPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/patients",
    element: <PrivateRoute role="doctor"><DoctorLayout><PatientListPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/patients/:patientId/records",
    element: <PrivateRoute role="doctor"><DoctorLayout><PatientRecordsPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/patients/:patientId/analytics",
    element: <PrivateRoute role="doctor"><DoctorLayout><PatientAnalyticsPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/approve",
    element: <PrivateRoute role="doctor"><DoctorLayout><PatientApprovalPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/common-questions",
    element: <PrivateRoute role="doctor"><DoctorLayout><CommonQPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/ai-questions",
    element: <PrivateRoute role="doctor"><DoctorLayout><AIReviewPage /></DoctorLayout></PrivateRoute>,
  },
  {
    path: "/doctor/mypage",
    element: <PrivateRoute role="doctor"><DoctorLayout><DoctorMyPage /></DoctorLayout></PrivateRoute>,
  },
  // ── 환자 ──────────────────────────────────────────────────
  {
    path: "/patient",
    element: <PrivateRoute role="patient"><RecordListPage /></PrivateRoute>,
  },
  {
    path: "/patient/record",
    element: <PrivateRoute role="patient"><RecordSubmitPage /></PrivateRoute>,
  },
  {
    path: "/patient/survey/common",
    element: <PrivateRoute role="patient"><CommonSurveyPage /></PrivateRoute>,
  },
  {
    path: "/patient/survey/ai",
    element: <PrivateRoute role="patient"><AiSurveyPage /></PrivateRoute>,
  },
  {
    path: "/patient/survey/done",
    element: <PrivateRoute role="patient"><SurveyDonePage /></PrivateRoute>,
  },
  {
    path: "/patient/mypage",
    element: <PrivateRoute role="patient"><PatientMyPage /></PrivateRoute>,
  },
]);


export default router;


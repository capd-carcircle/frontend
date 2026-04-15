import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginPage from '../pages/auth/LoginPage'
import RecordSubmitPage from '../pages/patient/RecordSubmitPage'
import SurveyPage from '../pages/patient/SurveyPage'
import SurveyDonePage from '../pages/patient/SurveyDonePage'

// 준비 중 placeholder
const PlaceholderPage = ({ title }: { title: string }) => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>{title}</h2>
    <p>준비 중입니다.</p>
  </div>
)

// 로그인 필요 라우트 보호
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  // ── 의사 ────────────────────────────────────────────────────
  {
    path: '/doctor',
    element: <PrivateRoute><PlaceholderPage title="의사 대시보드" /></PrivateRoute>,
  },
  // ── 환자 ────────────────────────────────────────────────────
  {
    path: '/patient',
    element: <Navigate to="/patient/record" replace />,
  },
  {
    path: '/patient/record',
    element: <PrivateRoute><RecordSubmitPage /></PrivateRoute>,
  },
  {
    path: '/patient/survey',
    element: <PrivateRoute><SurveyPage /></PrivateRoute>,
  },
  {
    path: '/patient/survey/done',
    element: <PrivateRoute><SurveyDonePage /></PrivateRoute>,
  },
])

export default router

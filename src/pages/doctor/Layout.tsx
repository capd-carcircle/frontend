import React from "react";
import { useLocation, useNavigate } from "react-router";

const C = {
  primary:     'var(--capd-primary)',
  primaryLight:'var(--capd-primary-light)',
  primaryDark: 'var(--capd-primary-dark)',
  bg:          'var(--capd-bg)',
  border:      'var(--capd-border)',
  text:        '#1a1a2e',
  textMuted:   '#6b7280',
  textLight:   '#9ca3af',
}

const navItems = [
  { id: 'dashboard', label: '대시보드',      icon: '◈',  path: '/doctor' },
  { id: 'approve',   label: '환자 가입 승인', icon: '👥', path: '/doctor/approve' },
  { id: 'questions', label: '공통 질문',      icon: '❓', path: '/doctor/common-questions' },
  { id: 'ai-questions', label: 'AI 맞춤 질문', icon: '🤖', path: '/doctor/ai-questions' },
]

interface DoctorLayoutProps {
  children: React.ReactNode
  doctorName?: string
}

export function DoctorLayout({ children, doctorName = 'Dr. 김의사' }: DoctorLayoutProps) {
  const location = useLocation()
  const navigate  = useNavigate()

  const isActive = (path: string) => {
    if (path === '/doctor') return location.pathname === '/doctor'
    return location.pathname.startsWith(path)
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: C.bg,
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      {/* ── 사이드바 ── */}
      <aside style={{
        width: 240,
        background: '#fff',
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
      }}>
        {/* 로고 + 의사 프로필 */}
        <div style={{ padding: '28px 24px 20px' }}>
          {/* CAPD 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: C.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 900, letterSpacing: -1 }}>C</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, color: C.text, letterSpacing: '-0.03em' }}>CAPD</span>
          </div>

          {/* 의사 프로필 카드 */}
          <div style={{
            background: C.bg,
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: C.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: C.primary, flexShrink: 0,
            }}>
              {doctorName[3] ?? 'D'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{doctorName}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>신장분과전문의</div>
            </div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav style={{ flex: 1, padding: '0 12px' }}>
          {navItems.map(item => {
            const active = isActive(item.path)
            return (
              <div
                key={item.id}
                onClick={() => navigate(item.path)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  marginBottom: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: active ? C.primaryLight : 'transparent',
                  color: active ? C.primaryDark : C.textMuted,
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  transition: 'all 0.15s',
                  userSelect: 'none',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLDivElement).style.background = C.bg
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </div>
            )
          })}
        </nav>

        {/* 하단: 버전 + 로그아웃 */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ fontSize: 11, color: C.textLight }}>CAPD 관리 시스템 v1.0</div>
          <div
            onClick={handleLogout}
            style={{
              fontSize: 13, color: C.textMuted, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
            }}
          >
            <span>↩</span> 로그아웃
          </div>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <div style={{ marginLeft: 240, flex: 1, minHeight: '100vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

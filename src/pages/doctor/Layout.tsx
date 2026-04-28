import React, { useState, useEffect } from "react";
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
  { id: 'dashboard',    label: '대시보드',      icon: '◈',  path: '/doctor' },
  { id: 'patients',     label: '담당 환자 관리',  icon: '🧑‍⚕️', path: '/doctor/patients' },
  { id: 'approve', label: '담당 연결 관리', icon: '🔗', path: '/doctor/approve' },
  { id: 'questions',    label: '공통 질문',      icon: '❓', path: '/doctor/common-questions' },
  { id: 'ai-questions', label: 'AI 질문 검토',   icon: '🤖', path: '/doctor/ai-questions' },
  { id: 'mypage',       label: '마이페이지',     icon: '👤', path: '/doctor/mypage' },
]

const MOBILE_BP = 768

interface DoctorLayoutProps {
  children: React.ReactNode
  doctorName?: string
}

export function DoctorLayout({ children, doctorName }: DoctorLayoutProps) {
  const location = useLocation()
  const navigate  = useNavigate()

  // 실제 로그인한 의사 이름을 localStorage에서 읽어 "OOO 선생님" 형식으로 표시
  const storedName = localStorage.getItem('user_name') ?? ''
  const displayName = doctorName ?? (storedName ? `${storedName} 선생님` : '선생님')
  const avatarChar = storedName ? storedName[0] : 'D'

  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BP)
  // 데스크톱: 사이드바 열림 여부 / 모바일: 상단 메뉴 열림 여부
  const [open, setOpen] = useState(!isMobile)

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BP
      setIsMobile(mobile)
      // 뷰포트 전환 시 기본값: 데스크톱=열림, 모바일=닫힘
      if (mobile !== isMobile) setOpen(!mobile)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isMobile])

  // 모바일에서 메뉴 항목 클릭 시 자동으로 닫기
  const handleNav = (path: string) => {
    navigate(path)
    if (isMobile) setOpen(false)
  }

  const isActive = (path: string) => {
    if (path === '/doctor') return location.pathname === '/doctor'
    return location.pathname.startsWith(path)
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  // ────────────────────────────────────────────────
  //  데스크톱 레이아웃 (사이드바 — 왼쪽)
  // ────────────────────────────────────────────────
  if (!isMobile) {
    const sidebarW = open ? 240 : 64

    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        background: C.bg,
        fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
      }}>
        {/* 사이드바 */}
        <aside style={{
          width: sidebarW,
          background: '#fff',
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'fixed',
          top: 0, left: 0,
          height: '100vh',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          zIndex: 100,
        }}>
          {/* 로고 + 토글 버튼 */}
          <div style={{
            padding: open ? '20px 16px 16px' : '20px 0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: open ? 'space-between' : 'center',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {open && (
              <div
                onClick={() => navigate('/doctor')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: C.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, letterSpacing: -1 }}>C</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 15, color: C.text, whiteSpace: 'nowrap' }}>CAPD</span>
              </div>
            )}
            {!open && (
              <div
                onClick={() => navigate('/doctor')}
                style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: C.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, letterSpacing: -1 }}>C</span>
              </div>
            )}
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, borderRadius: 6,
                color: C.textMuted, fontSize: 16, lineHeight: 1,
                flexShrink: 0,
              }}
              title={open ? '접기' : '펼치기'}
            >
              {open ? '◀' : '▶'}
            </button>
          </div>

          {/* 의사 프로필 (펼쳐진 상태에서만) */}
          {open && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{
                background: C.bg, borderRadius: 10,
                padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: C.primaryLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: C.primary, flexShrink: 0,
                }}>
                  {avatarChar}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{displayName}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>신장분과전문의</div>
                </div>
              </div>
            </div>
          )}

          {/* 접힌 상태: 프로필 아이콘만 */}
          {!open && (
            <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: C.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: C.primary,
              }}>
                {avatarChar}
              </div>
            </div>
          )}

          {/* 네비게이션 */}
          <nav style={{ flex: 1, padding: open ? '0 10px' : '0 8px' }}>
            {navItems.map(item => {
              const active = isActive(item.path)
              return (
                <div
                  key={item.id}
                  onClick={() => handleNav(item.path)}
                  title={!open ? item.label : undefined}
                  style={{
                    padding: open ? '9px 10px' : '10px 0',
                    borderRadius: 10,
                    marginBottom: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: open ? 'flex-start' : 'center',
                    gap: open ? 9 : 0,
                    background: active ? C.primaryLight : 'transparent',
                    color: active ? C.primaryDark : C.textMuted,
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    transition: 'background 0.15s',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = C.bg
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  {open && item.label}
                </div>
              )
            })}
          </nav>

          {/* 하단: 버전 + 로그아웃 */}
          <div style={{
            padding: open ? '14px 16px' : '14px 8px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: open ? 'flex-start' : 'center',
            gap: 6,
          }}>
            {open && <div style={{ fontSize: 10, color: C.textLight }}>CAPD 관리 시스템 v1.0</div>}
            <div
              onClick={handleLogout}
              title={!open ? '로그아웃' : undefined}
              style={{
                fontSize: 12, color: C.textMuted, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                gap: open ? 5 : 0,
                padding: '3px 0',
              }}
            >
              <span style={{ fontSize: 14 }}>↩</span>
              {open && '로그아웃'}
            </div>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <div style={{ marginLeft: sidebarW, flex: 1, minHeight: '100vh', transition: 'margin-left 0.2s ease' }}>
          {children}
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────
  //  모바일 레이아웃 (상단 헤더 + 드롭다운 메뉴)
  // ────────────────────────────────────────────────
  const HEADER_H = 52

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      {/* 상단 헤더 바 */}
      <header style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: HEADER_H,
        background: '#fff',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 200,
      }}>
        {/* 로고 */}
        <div
          onClick={() => { navigate('/doctor'); setOpen(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: C.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>C</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>CAPD</span>
        </div>

        {/* 현재 페이지 이름 */}
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>
          {navItems.find(i => isActive(i.path))?.label ?? ''}
        </span>

        {/* 햄버거 / 닫기 버튼 */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 8px', borderRadius: 8,
            fontSize: 18, color: C.text, lineHeight: 1,
          }}
        >
          {open ? '✕' : '☰'}
        </button>
      </header>

      {/* 드롭다운 메뉴 (열렸을 때) */}
      {open && (
        <>
          {/* 배경 오버레이 */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.25)',
              zIndex: 150,
              top: HEADER_H,
            }}
          />
          {/* 메뉴 패널 */}
          <div style={{
            position: 'fixed',
            top: HEADER_H, left: 0, right: 0,
            background: '#fff',
            borderBottom: `1px solid ${C.border}`,
            zIndex: 160,
            padding: '8px 12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            {/* 의사 프로필 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px 12px',
              borderBottom: `1px solid ${C.border}`,
              marginBottom: 6,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: C.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: C.primary,
              }}>
                {avatarChar}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{displayName}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>신장분과전문의</div>
              </div>
            </div>

            {/* 메뉴 항목들 */}
            {navItems.map(item => {
              const active = isActive(item.path)
              return (
                <div
                  key={item.id}
                  onClick={() => handleNav(item.path)}
                  style={{
                    padding: '11px 12px',
                    borderRadius: 10,
                    marginBottom: 2,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: active ? C.primaryLight : 'transparent',
                    color: active ? C.primaryDark : C.textMuted,
                    fontWeight: active ? 700 : 500,
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </div>
              )
            })}

            {/* 로그아웃 */}
            <div
              onClick={handleLogout}
              style={{
                padding: '11px 12px',
                marginTop: 4,
                borderTop: `1px solid ${C.border}`,
                cursor: 'pointer',
                display: 'flex',                 display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, color: C.textMuted,
              }}
            >
              <span>↩</span> 로그아웃
            </div>
          </div>
        </>
      )}

      {/* 메인 콘텐츠 */}
      <div style={{ paddingTop: HEADER_H, minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  )
}

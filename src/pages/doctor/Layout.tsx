import React, { useState, useEffect, useCallback, useRef } from "react";
import logoFull from '../../assets/logo_full.png';
import { useLocation, useNavigate } from "react-router";
import { logoutApi } from '../../api/auth';
import useAuthStore from '../../store/authStore';

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

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

export function DoctorLayout({ children, doctorName }: DoctorLayoutProps) {
  const location = useLocation()
  const navigate  = useNavigate()

  // 실제 로그인한 의사 이름을 sessionStorage에서 읽어 "OOO 선생님" 형식으로 표시
  const storedName = sessionStorage.getItem('user_name') ?? ''
  const displayName = doctorName ?? (storedName ? `${storedName} 선생님` : '선생님')
  const avatarChar = storedName ? storedName[0] : 'D'

  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BP)
  // 데스크톱: 사이드바 열림 여부 / 모바일: 상단 메뉴 열림 여부
  const [open, setOpen] = useState(!isMobile)
  const [pendingCount, setPendingCount] = useState(0)
  const prevPendingRef = useRef<number | null>(null)
  // 데스크톱에서 사용자가 수동으로 접은 상태 기억 (모바일 전환 후 복귀 시 유지)
  const desktopCollapsedRef = useRef<boolean>(false)

  // 브라우저 알림 권한 요청 (한 번만)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const fetchPendingCount = useCallback(async () => {
    const token = sessionStorage.getItem('access_token')
    if (!token) return
    try {
      const res = await fetch(`${API}/api/v1/registration/doctor/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const cnt = Array.isArray(data) ? data.length : 0
        setPendingCount(cnt)
        // 이전 값보다 늘어난 경우 브라우저 알림 발송
        if (
          prevPendingRef.current !== null &&
          cnt > prevPendingRef.current &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('CAPD — 새 연결 요청', {
            body: `처리 대기 중인 연결 요청이 ${cnt}건 있습니다.`,
            icon: '/favicon.ico',
          })
        }
        prevPendingRef.current = cnt
      }
    } catch { /* 무시 */ }
  }, [])

  useEffect(() => {
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 15000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchPendingCount() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [fetchPendingCount])

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BP
      setIsMobile(mobile)
      if (mobile !== isMobile) {
        if (mobile) {
          // 데스크톱 → 모바일: 현재 collapse 상태 저장 후 모바일 메뉴 닫기
          desktopCollapsedRef.current = !open
          setOpen(false)
        } else {
          // 모바일 → 데스크톱: 이전 collapse 상태 복원
          setOpen(!desktopCollapsedRef.current)
        }
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isMobile, open])

  // 모바일에서 메뉴 항목 클릭 시 자동으로 닫기
  const handleNav = (path: string) => {
    navigate(path)
    if (isMobile) setOpen(false)
  }

  const isActive = (path: string) => {
    if (path === '/doctor') return location.pathname === '/doctor'
    return location.pathname.startsWith(path)
  }

  const handleLogout = async () => {
    try {
      await logoutApi()
    } catch {
      // 서버 오류여도 클라이언트 로그아웃은 진행
    } finally {
      useAuthStore.getState().logout()
      navigate('/login')
    }
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
                <img src={logoFull} alt="CAPD" style={{ height: 28, objectFit: 'contain' }} />
              </div>
            )}
            <button
              onClick={() => {
                const next = !open
                desktopCollapsedRef.current = !next
                setOpen(next)
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 8px', borderRadius: 6,
                color: C.textMuted, fontSize: 14, lineHeight: 1,
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: open ? 'auto' : 40, height: open ? 'auto' : 32,
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
              const badge = item.id === 'approve' && pendingCount > 0 ? pendingCount : 0
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
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = C.bg
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 15, position: 'relative' }}>
                    {item.icon}
                    {!open && badge > 0 && (
                      <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 800, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  {open && item.label}
                  {open && badge > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 800, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
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
          <img src={logoFull} alt="CAPD" style={{ height: 26, objectFit: 'contain' }} />
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
              const badge = item.id === 'approve' && pendingCount > 0 ? pendingCount : 0
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
                  {badge > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 12, fontWeight: 800, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
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
                display: 'flex', alignItems: 'center', gap: 10,
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

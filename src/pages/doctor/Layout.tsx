import React from "react";
import { useLocation, useNavigate } from "react-router";

/* =========================================================
   STYLES
   ========================================================= */
const S: { [key: string]: React.CSSProperties } = {
  root:            { display: "flex", height: "100vh", backgroundColor: "#eff1f5", overflow: "hidden", fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" },
  sidebar:         { width: 200, minHeight: "100vh", backgroundColor: "#1b508a", display: "flex", flexDirection: "column", flexShrink: 0 },
  sidebarHeader:   { padding: "20px 20px 12px" },
  sidebarTitle:    { color: "#ffffff", fontSize: 18, fontWeight: 700, margin: 0 },
  sidebarSubtitle: { color: "#b2cce5", fontSize: 11, marginTop: 4 },
  navBase:         { width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 12, border: "none", cursor: "pointer", transition: "background 0.2s" },
  navActive:       { backgroundColor: "#2e75b5", color: "#ffffff" },
  navInactive:     { backgroundColor: "transparent", color: "#b2cce5" },
  content:         { flex: 1, overflowY: "auto" as const },
};

/* =========================================================
   NAV ITEMS
   ========================================================= */
const navItems = [
  { icon: "📊", label: "대시보드",     path: "/doctor" },
  { icon: "📋", label: "기록 검토",    path: "/doctor/record" },
  { icon: "❓", label: "공통 질문",    path: "/doctor/common-questions" },
  { icon: "🤖", label: "AI 맞춤 질문", path: "/doctor/ai-questions" },
];

/* =========================================================
   COMPONENT
   ========================================================= */
interface DoctorLayoutProps {
  children: React.ReactNode;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/doctor") return location.pathname === "/doctor";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <style>{`
        .nav-btn:hover { background-color: rgba(46,117,181,0.4) !important; color: #fff !important; }
      `}</style>
      <div style={S.root}>
        {/* ── Sidebar ── */}
        <aside style={S.sidebar}>
          <div style={S.sidebarHeader}>
            <p style={S.sidebarTitle}>CAPD</p>
            <p style={S.sidebarSubtitle}>Dr. 김의사</p>
          </div>
          <nav>
            {navItems.map((item) => (
              <button
                key={item.label}
                className="nav-btn"
                style={{ ...S.navBase, ...(isActive(item.path) ? S.navActive : S.navInactive) }}
                onClick={() => navigate(item.path)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Page Content ── */}
        <div style={S.content}>
          {children}
        </div>
      </div>
    </>
  );
}

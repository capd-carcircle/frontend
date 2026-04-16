import React from "react";
import { useNavigate } from "react-router-dom";

/* =========================================================
   STYLES
   ========================================================= */
const S: { [key: string]: React.CSSProperties } = {
  main:            { flex: 1, overflowY: "auto", padding: 24 },
  pageTitle:       { color: "#1f1f1f", fontSize: 20, fontWeight: 700, margin: 0 },
  pageSubtitle:    { color: "#8c8c8c", fontSize: 11, marginTop: 4 },
  statsGrid:       { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, margin: "20px 0 16px" },
  statCard:        { backgroundColor: "#ffffff", borderRadius: 8, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  statLabel:       { color: "#8c8c8c", fontSize: 11, margin: 0, marginBottom: 4 },
  statValue:       { fontSize: 22, fontWeight: 700, margin: 0 },
  tableCard:       { backgroundColor: "#ffffff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" },
  tableCardHeader: { padding: "16px 20px 8px" },
  tableCardTitle:  { color: "#1f1f1f", fontSize: 13, fontWeight: 700, margin: 0 },
  table:           { width: "100%", borderCollapse: "collapse" },
  thead:           { backgroundColor: "#dbdbdb" },
  th:              { textAlign: "left", padding: "7px 16px", fontSize: 10, fontWeight: 700, color: "#1f1f1f" },
  td:              { padding: "13px 16px", fontSize: 12, color: "#1f1f1f" },
  rowEven:         { backgroundColor: "#ffffff" },
  rowOdd:          { backgroundColor: "#fafafc" },
  badgeRed:        { color: "#cc3333", fontWeight: 700 },
  badgeGreen:      { color: "#2b8c47", fontWeight: 700 },
  badgeGray:       { color: "#8c8c8c", fontWeight: 700 },
  viewBtn:         { backgroundColor: "#2e75b5", color: "#ffffff", fontSize: 11, fontWeight: 700, padding: "5px 14px", border: "none", borderRadius: 6, cursor: "pointer" },
};

/* =========================================================
   DATA
   ========================================================= */
const stats = [
  { label: "오늘 제출",  value: "12건", color: "#2e75b5" },
  { label: "미검토",     value: "5건",  color: "#cc3333" },
  { label: "승인 완료",  value: "7건",  color: "#2b8c47" },
  { label: "총 환자 수", value: "23명", color: "#1b508a" },
];

const records = [
  { id: 1, name: "홍길동", time: "08:23 AM", status: "미검토",   unreviewed: "3개" },
  { id: 2, name: "김환자", time: "09:15 AM", status: "검토 중",  unreviewed: "1개" },
  { id: 3, name: "이복막", time: "10:02 AM", status: "승인 완료", unreviewed: "-"  },
  { id: 4, name: "박투석", time: "10:45 AM", status: "미검토",   unreviewed: "2개" },
  { id: 5, name: "최신장", time: "11:30 AM", status: "미검토",   unreviewed: "2개" },
  { id: 6, name: "강신부", time: "12:10 PM", status: "승인 완료", unreviewed: "-"  },
];

/* =========================================================
   SUB COMPONENTS
   ========================================================= */
function StatusBadge({ status }: { status: string }) {
  if (status === "미검토")    return <span style={S.badgeRed}>{status}</span>;
  if (status === "승인 완료") return <span style={S.badgeGreen}>{status}</span>;
  return <span style={S.badgeGray}>{status}</span>;
}

/* =========================================================
   COMPONENT  ← onView prop 없어짐, navigate 직접 사용
   ========================================================= */
export default function DashboardPage() {
  const navigate = useNavigate();

  const handleView = (record: typeof records[0]) => {
    navigate("/doctor/record", { state: { record } });
  };

  return (
    <>
      <style>{`.view-btn:hover { background-color: #1b508a !important; }`}</style>

      <main style={S.main}>
        <div>
          <h1 style={S.pageTitle}>대시보드</h1>
          <p style={S.pageSubtitle}>2025년 4월 13일 기준</p>
        </div>

        <div style={S.statsGrid}>
          {stats.map((stat) => (
            <div key={stat.label} style={S.statCard}>
              <p style={S.statLabel}>{stat.label}</p>
              <p style={{ ...S.statValue, color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div style={S.tableCard}>
          <div style={S.tableCardHeader}>
            <p style={S.tableCardTitle}>오늘 제출된 기록</p>
          </div>
          <table style={S.table}>
            <thead style={S.thead}>
              <tr>
                <th style={S.th}>환자명</th>
                <th style={S.th}>제출 시간</th>
                <th style={S.th}>상태</th>
                <th style={S.th}>미검토 항목</th>
                <th style={S.th} />
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={record.id} style={index % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.td}>{record.name}</td>
                  <td style={S.td}>{record.time}</td>
                  <td style={S.td}><StatusBadge status={record.status} /></td>
                  <td style={S.td}>{record.unreviewed}</td>
                  <td style={S.td}>
                    <button className="view-btn" style={S.viewBtn} onClick={() => handleView(record)}>
                      보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
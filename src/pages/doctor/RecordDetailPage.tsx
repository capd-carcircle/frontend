import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

/* =========================================================
   STYLES  (기존과 동일)
   ========================================================= */
const S: { [key: string]: React.CSSProperties } = {
  main:      { flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  titleRow:  { display: "flex", alignItems: "center", gap: 12 },
  pageTitle: { color: "#1f1f1f", fontSize: 18, fontWeight: 700, margin: 0 },
  backBtn:   { backgroundColor: "#dbdbdb", color: "#1f1f1f", fontSize: 11, fontWeight: 700, padding: "6px 14px", border: "none", borderRadius: 6, cursor: "pointer" },
  approveBtn:{ backgroundColor: "#2b8c47", color: "#ffffff", fontSize: 11, fontWeight: 700, padding: "10px 20px", border: "none", borderRadius: 6, cursor: "pointer" },
  card:      { backgroundColor: "#ffffff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "16px 16px 20px" },
  cardTitle: { color: "#1f1f1f", fontSize: 13, fontWeight: 700, margin: 0, marginBottom: 10 },
  table:     { width: "100%", borderCollapse: "collapse" },
  thDark:    { backgroundColor: "#1b508a", color: "#ffffff", fontSize: 9, fontWeight: 700, padding: "6px 10px", textAlign: "left" },
  thLight:   { backgroundColor: "#dbdbdb", color: "#1f1f1f", fontSize: 9, fontWeight: 700, padding: "6px 10px", textAlign: "left" },
  tdLabel:   { backgroundColor: "#f2f7ff", fontSize: 9, padding: "8px 10px", color: "#1f1f1f" },
  tdEven:    { backgroundColor: "#ffffff", fontSize: 9, padding: "8px 10px", color: "#1f1f1f" },
  tdOdd:     { backgroundColor: "#f7f7f7", fontSize: 9, padding: "8px 10px", color: "#1f1f1f" },
  aiBox:     { backgroundColor: "#edf5ff", borderRadius: 4, padding: "12px 14px", fontSize: 11, color: "#1f1f1f", lineHeight: 1.7 },
  emrBox:    { backgroundColor: "#edfff2", borderRadius: 4, padding: "12px 14px", fontSize: 10, color: "#1f1f1f", lineHeight: 2, display: "flex", flexDirection: "column", gap: 0 },
  bottomRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  qaQuestion:{ color: "#8c8c8c", fontSize: 10, margin: 0, marginTop: 12 },
  qaAnswer:  { color: "#1f1f1f", fontSize: 13, fontWeight: 700, margin: 0, marginTop: 2 },
};

/* =========================================================
   DATA  (기존과 동일)
   ========================================================= */
const capdRows = [
  { label: "교환 시간",    values: ["06:00", "10:00", "14:00", "18:00", "22:00"], alt: false },
  { label: "배액량 (g)",   values: ["1850",  "2100",  "1950",  "2050",  "-"],     alt: true  },
  { label: "투석액 농도",  values: ["1.5%",  "2.5%",  "1.5%",  "2.5%",  "-"],     alt: false },
  { label: "주입액 (g)",   values: ["2000",  "2000",  "2000",  "2000",  "-"],     alt: true  },
  { label: "한외여과 (g)", values: ["-150",  "100",   "-50",   "50",    "-"],     alt: false },
];

const commonQA = [
  { q: "불편한 점이 있었나요?", a: "없었음" },
  { q: "복통/팽만감?",          a: "없었음" },
  { q: "투석액 색 이상?",       a: "없었음" },
];

const aiQA = [
  { q: "수분 섭취가 많았나요?", a: "약간 많이 마셨음" },
  { q: "두통/어지러움?",        a: "약간 있었음" },
];

/* =========================================================
   COMPONENT  ← prop 없어짐, location.state에서 record 꺼냄
   ========================================================= */
export default function RecordDetailPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const record    = location.state?.record;

  // 직접 URL 접근 등 record가 없을 경우 안전 처리
  if (!record) {
    return (
      <main style={{ padding: 24 }}>
        <p>기록을 찾을 수 없습니다.</p>
        <button onClick={() => navigate("/doctor/dashboard")}>← 대시보드로</button>
      </main>
    );
  }

  return (
    <>
      <style>{`
        .back-btn:hover    { background-color: #c8c8c8 !important; }
        .approve-btn:hover { background-color: #236e39 !important; }
      `}</style>

      <main style={S.main}>
        {/* ── Header ── */}
        <div style={S.headerRow}>
          <div style={S.titleRow}>
            <h1 style={S.pageTitle}>{record.name} 환자 — {record.time}</h1>
            <button className="back-btn" style={S.backBtn} onClick={() => navigate(-1)}>← 목록</button>
          </div>
          <button className="approve-btn" style={S.approveBtn}>✅ 기록 승인</button>
        </div>

        {/* 이하 기존 내용 그대로 */}
        <div style={S.card}>
          <p style={S.cardTitle}>CAPD 투석 기록</p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thDark}>구분</th>
                {["1회차", "2회차", "3회차", "4회차", "5회차"].map((h) => (
                  <th key={h} style={S.thLight}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capdRows.map((row) => (
                <tr key={row.label}>
                  <td style={S.tdLabel}>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} style={row.alt ? S.tdOdd : S.tdEven}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>🤖 AI 일일 요약</p>
          <div style={S.aiBox}>
            총 한외여과량 -50g (평소 대비 낮음). 2.5% 투석액 사용 비중 증가. 흐린 투석액 미관찰.
            체중 전일 대비 +0.5kg 증가. 혈압 140/90mmHg — KDIGO 기준 초과, 추가 모니터링 권장.
          </div>
        </div>

        <div style={S.card}>
          <p style={S.cardTitle}>📄 EMR 형식 요약</p>
          <div style={S.emrBox}>
            <span>S: 환자 CAPD 4회 시행. 복통 없음. 흐린 투석액 없음.</span>
            <span>O: 체중 62.5kg (+0.5kg), 혈압 140/90mmHg, 공복혈당 108mg/dL</span>
            <span>&nbsp;&nbsp;&nbsp;총 한외여과량 -50g / 총 배액량 7,950g</span>
            <span>A: 한외여과 부족 가능성. 혈압 상승 주의 필요.</span>
            <span>P: 혈압 모니터링 강화. 수분 섭취 제한 교육 권고.</span>
          </div>
        </div>

        <div style={S.bottomRow}>
          <div style={S.card}>
            <p style={S.cardTitle}>💬 공통 질문 응답</p>
            {commonQA.map((item) => (
              <div key={item.q}>
                <p style={S.qaQuestion}>{item.q}</p>
                <p style={S.qaAnswer}>{item.a}</p>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <p style={S.cardTitle}>🤖 AI 맞춤 질문 응답</p>
            {aiQA.map((item) => (
              <div key={item.q}>
                <p style={S.qaQuestion}>{item.q}</p>
                <p style={S.qaAnswer}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
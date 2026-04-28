import React, { useEffect, useState } from "react";
import { AIQuestionRow, listAIQuestions, rejectAIQuestion } from "../../api/questions";
import { COLOR, btn, card, typography } from "../../styles/doctor";

/* ── 아이콘 ────────────────────────────────────────────────────── */
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── 상태 배지 ─────────────────────────────────────────────────── */
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:              { label: "검토 대기", color: COLOR.primary,  bg: COLOR.blue50 },
    approved:             { label: "승인됨",    color: COLOR.success,  bg: COLOR.green50 },
    rejected_for_patient: { label: "환자 거절", color: COLOR.danger,   bg: "#fff0f0" },
    rejected_global:      { label: "전역 거절", color: "#7a4f00",      bg: "#fff8e1" },
  };
  const s = map[status] ?? { label: status, color: COLOR.gray, bg: COLOR.grayBg };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
};

/* ── 질문 타입 라벨 ────────────────────────────────────────────── */
const typeLabel = (t: string) =>
  ({ yes_no: "예/아니오", single_select: "단일 선택", multi_select: "다중 선택", short_text: "단답" }[t] ?? t);

/* ── 메인 컴포넌트 ─────────────────────────────────────────────── */
export default function AIReviewPage() {
  const [questions, setQuestions]         = useState<AIQuestionRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [patientFilter, setPatientFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter]   = useState<string>("pending");
  const [rejecting, setRejecting]         = useState<number | null>(null);

  // 나이/성별 헬퍼
  const calcAge = (b: string | null, ref?: string) => {
    if (!b) return null
    const refD  = ref ? new Date(ref + 'T00:00:00') : new Date()
    const birth = new Date(b + 'T00:00:00')
    let age = refD.getFullYear() - birth.getFullYear()
    const m = refD.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && refD.getDate() < birth.getDate())) age--
    return age
  }
  const patientLabel = (name: string, birth: string | null, gender: string | null, ref?: string) => {
    const age = calcAge(birth, ref); const g = gender === 'm' ? '남' : gender === 'f' ? '여' : null
    if (age !== null && g) return `${name}(${age}/${g})`
    if (age !== null) return `${name}(${age})`
    if (g) return `${name}(${g})`
    return name
  }

  // 환자 목록 (questions에서 추출)
  const patients = Array.from(
    new Map(questions.map((q) => [q.patient_id, { name: q.patient_name, birth: q.patient_birth_date, gender: q.patient_gender }])).entries()
  ).map(([id, p]) => ({ id, name: p.name, birth: p.birth, gender: p.gender }));

  useEffect(() => {
    setLoading(true);
    listAIQuestions(patientFilter !== "" ? (patientFilter as number) : undefined)
      .then(setQuestions)
      .catch(() => setError("AI 질문을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [patientFilter]);

  const filtered = questions.filter((q) =>
    statusFilter === "all" ? true : q.status === statusFilter
  );

  const handleReject = async (q: AIQuestionRow, scope: "patient" | "global") => {
    const label = scope === "global" ? "전체 환자에게 전역 거절" : "이 환자에게만 거절";
    if (!window.confirm(`"${q.question_text}"\n\n→ ${label}하시겠습니까?`)) return;
    setRejecting(q.id);
    try {
      await rejectAIQuestion(q.id, scope);
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? { ...item, status: scope === "global" ? "rejected_global" : "rejected_for_patient" }
            : item
        )
      );
    } catch {
      alert("거절 처리 중 오류가 발생했습니다.");
    } finally {
      setRejecting(null);
    }
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={typography.pageTitle}>AI 맞춤 질문 검토</h1>
        <p style={typography.pageSubtitle}>
          AI가 환자 기록을 분석해 생성한 질문을 검토하고, 부적절한 질문을 거절하세요.
        </p>
      </div>

      {/* 필터 바 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={patientFilter}
          onChange={(e) => setPatientFilter(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLOR.grayLight}`, fontSize: 13, color: COLOR.text, background: COLOR.white }}
        >
          <option value="">전체 환자</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{patientLabel(p.name, p.birth, p.gender)}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLOR.grayLight}`, fontSize: 13, color: COLOR.text, background: COLOR.white }}
        >
          <option value="pending">검토 대기</option>
          <option value="approved">승인됨</option>
          <option value="rejected_for_patient">환자 거절</option>
          <option value="rejected_global">전역 거절</option>
          <option value="all">전체</option>
        </select>

        <span style={{ marginLeft: "auto", fontSize: 12, color: COLOR.textMuted }}>
          {filtered.length}개 질문
        </span>
      </div>

      {/* 본문 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: COLOR.textMuted, fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: COLOR.danger, fontSize: 13 }}>
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card.base, textAlign: "center", padding: "40px 20px", color: COLOR.textMuted, fontSize: 13 }}>
          해당 조건의 AI 질문이 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((q) => (
            <div
              key={q.id}
              style={{
                ...card.base,
                padding: "14px 16px",
                borderLeft: q.status === "pending"
                  ? `3px solid ${COLOR.primary}`
                  : `3px solid ${COLOR.grayLight}`,
                opacity: q.status !== "pending" ? 0.65 : 1,
              }}
            >
              {/* 상단: 환자명 + 날짜 + 타입 + 상태 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.text }}>{patientLabel(q.patient_name, q.patient_birth_date, q.patient_gender, q.record_date)}</span>
                <span style={{ fontSize: 11, color: COLOR.textMuted }}>{q.record_date}</span>
                <span style={{ fontSize: 11, color: COLOR.gray, background: COLOR.grayBg, padding: "1px 7px", borderRadius: 99 }}>
                  {typeLabel(q.question_type)}
                </span>
                <StatusBadge status={q.status} />
              </div>

              {/* 질문 내용 */}
              <p style={{ margin: "0 0 6px", fontSize: 14, color: COLOR.text, fontWeight: 500, lineHeight: 1.5 }}>
                {q.question_text}
              </p>

              {/* 생성 이유 */}
              {q.reason && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: COLOR.textMuted, lineHeight: 1.4 }}>
                  💡 생성 이유: {q.reason}
                </p>
              )}

              {/* 거절 버튼 (pending 상태만 표시) */}
              {q.status === "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleReject(q, "patient")}
                    disabled={rejecting === q.id}
                    style={{
                      ...btn.sm,
                      background: "transparent",
                      border: `1px solid ${COLOR.danger}`,
                      color: COLOR.danger,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <IconX /> 이 환자만 거절
                  </button>
                  <button
                    onClick={() => handleReject(q, "global")}
                    disabled={rejecting === q.id}
                    style={{
                      ...btn.sm,
                      background: "transparent",
                      border: `1px solid ${COLOR.gray}`,
                      color: COLOR.gray,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <IconX /> 전역 거절
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

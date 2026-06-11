import React, { useEffect, useState } from "react";
import {
  AIQuestionRow,
  listAIQuestions,
  rejectAIQuestion,
  restoreAIQuestion,
  reviewAIQuestion,
  promoteToCommonQuestion,
} from "../../api/questions";
import { useToast } from "../../hooks/useToast";
import { calcAge, patientLabel } from "../../utils/helpers";

/* ── 색상 (CSS 변수 기반) ───────────────────────────────── */
const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         'var(--text-main)',
  textMuted:    'var(--text-sub)',
  textLight:    'var(--text-muted)',
  success:      'var(--success)',
  successLight: 'var(--success-light)',
  warning:      'var(--warning)',
  warningLight: 'var(--warning-light)',
  danger:       'var(--danger)',
  dangerLight:  'var(--danger-light)',
  white:        '#ffffff',
}

/* ── 아이콘 ─────────────────────────────────────────────── */
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconStar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconGlobe = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const IconRotate = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
  </svg>
);

type TabType = "pending" | "approved" | "rejected";

const typeLabel = (t: string) =>
  ({ yes_no: "예/아니오", single_select: "단일선택", multi_select: "다중선택", short_text: "단답" }[t] ?? t);

const rejectLabel = (status: string) =>
  status === "rejected_for_patient" ? "환자 숨김" : "전역 거절";

/* ── 버튼 스타일 ─────────────────────────────────────────── */
const btnBase: React.CSSProperties = {
  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s",
  display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px",
};

export default function AIReviewPage() {
  const [questions, setQuestions]     = useState<AIQuestionRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [patientFilter, setPatientFilter] = useState<number | "">("");
  const [activeTab, setActiveTab]     = useState<TabType>("pending");
  const [busyId, setBusyId]           = useState<number | null>(null);
  const [rejectInput, setRejectInput] = useState<{ id: number; scope: "patient" | "global"; text: string } | null>(null);
  const [isMobile, setIsMobile]       = useState(() => window.innerWidth < 640);
  const toast    = useToast(3000);
  const errToast = useToast(3000);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

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

  const pendingList  = questions.filter((q) => q.status === "pending");
  const approvedList = questions.filter((q) => q.status === "approved");
  const rejectedList = questions.filter((q) =>
    q.status === "rejected_for_patient" || q.status === "rejected_global"
  );
  const tabList = activeTab === "pending"  ? pendingList
                : activeTab === "approved" ? approvedList
                : rejectedList;

  const handleReview = async (q: AIQuestionRow) => {
    setBusyId(q.id);
    try {
      const { status } = await reviewAIQuestion(q.id);
      setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, status } : item));
    } catch {
      errToast.show("처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const openRejectInput = (q: AIQuestionRow, scope: "patient" | "global") => {
    if (rejectInput?.id === q.id && rejectInput.scope === scope) {
      setRejectInput(null);
    } else {
      setRejectInput({ id: q.id, scope, text: "" });
    }
  };

  const handleReject = async (q: AIQuestionRow) => {
    if (!rejectInput) return;
    setBusyId(q.id);
    try {
      await rejectAIQuestion(q.id, rejectInput.scope, rejectInput.text || undefined);
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? { ...item, status: rejectInput.scope === "global" ? "rejected_global" : "rejected_for_patient" }
            : item
        )
      );
      setRejectInput(null);
    } catch {
      errToast.show("처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (q: AIQuestionRow) => {
    setBusyId(q.id);
    try {
      await restoreAIQuestion(q.id);
      setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, status: "pending" } : item));
    } catch {
      errToast.show("복구 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePromote = async (q: AIQuestionRow) => {
    setBusyId(q.id);
    try {
      await promoteToCommonQuestion(q);
      if (q.status === "pending") {
        await reviewAIQuestion(q.id);
        setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, status: "approved" } : item));
      }
      toast.show("공통질문에 추가됐어요. 공통질문 페이지에서 편집 후 활성화하세요.");
    } catch {
      errToast.show("공통질문 등록 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main style={{
      flex: 1, overflowY: "auto",
      padding: isMobile ? '16px' : '28px 32px',
      display: "flex", flexDirection: "column", gap: 16,
      background: C.bg, minHeight: 0,
    }}>
      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.04em' }}>
            AI 맞춤 질문 검토
          </h1>
          {!isMobile && (
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4, margin: '4px 0 0' }}>
              AI가 환자 기록을 분석해 생성한 질문을 검토하고 필요한 조치를 취하세요.
            </p>
          )}
        </div>
        {pendingList.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.dangerLight, borderRadius: 10, padding: '8px 14px',
            border: `1px solid ${C.danger}33`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.danger }}>{pendingList.length}</span>
            <span style={{ fontSize: 12, color: C.danger, fontWeight: 600 }}>건 검토 대기</span>
          </div>
        )}
      </div>

      {/* ── 통계 카드 (탭 겸용) ── */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "검토 대기", value: pendingList.length,  color: C.danger,   bg: C.dangerLight,  tab: "pending"  as TabType },
          { label: "확인됨",   value: approvedList.length, color: C.success,  bg: C.successLight, tab: "approved" as TabType },
          { label: "거절됨",   value: rejectedList.length, color: C.textMuted, bg: 'var(--bg-subtle)', tab: "rejected" as TabType },
        ].map(({ label, value, color, bg, tab }) => (
          <div key={label} onClick={() => setActiveTab(tab)} style={{
            background: C.white, borderRadius: 10,
            padding: isMobile ? "10px 12px" : "12px 18px",
            boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
            border: activeTab === tab ? `2px solid ${color}` : `2px solid transparent`,
            display: "flex", alignItems: "center", gap: 10,
            cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 16, fontWeight: 800, color }}>{value}</span>
            </div>
            <span style={{ fontSize: 12, color: activeTab === tab ? color : C.textMuted, fontWeight: activeTab === tab ? 700 : 500 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── 필터 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <select
          value={patientFilter}
          onChange={(e) => setPatientFilter(e.target.value === "" ? "" : Number(e.target.value))}
          style={{
            padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`,
            fontSize: 13, color: C.text, background: C.white,
            fontFamily: "inherit", outline: "none", cursor: "pointer",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <option value="">전체 환자</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{patientLabel(p.name, p.birth, p.gender)}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: C.textMuted }}>{tabList.length}개</span>
      </div>

      {/* ── 카드 목록 ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: C.textMuted, fontSize: 13 }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "48px", color: C.danger, fontSize: 13 }}>{error}</div>
      ) : tabList.length === 0 ? (
        <div style={{
          background: C.white, borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          textAlign: "center", padding: "48px 20px",
        }}>
          <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
            {activeTab === "pending" ? "검토 대기 중인 질문이 없어요." :
             activeTab === "approved" ? "확인된 질문이 없어요." : "거절된 질문이 없어요."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tabList.map((q) => {
            const isBusy     = busyId === q.id;
            const isRejected = q.status === "rejected_for_patient" || q.status === "rejected_global";
            const isApproved = q.status === "approved";
            const showRejectPanel = rejectInput?.id === q.id;

            const borderColor = isApproved ? C.success
              : isRejected ? C.border
              : C.primary;

            return (
              <div
                key={q.id}
                style={{
                  background: C.white, borderRadius: 12,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  overflow: "hidden",
                  borderLeft: `3px solid ${borderColor}`,
                  opacity: isRejected ? 0.8 : 1,
                }}
              >
                {/* 카드 본문 */}
                <div style={{ padding: "14px 16px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {patientLabel(q.patient_name, q.patient_birth_date, q.patient_gender, q.record_date)}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, padding: "2px 8px", borderRadius: 99, border: `1px solid ${C.border}` }}>
                      {q.record_date}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, padding: "2px 8px", borderRadius: 99, border: `1px solid ${C.border}` }}>
                      {typeLabel(q.question_type)}
                    </span>
                    {isRejected && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                        color: q.status === "rejected_global" ? C.warning : C.danger,
                        background: q.status === "rejected_global" ? C.warningLight : C.dangerLight,
                        border: `1px solid ${q.status === "rejected_global" ? C.warning : C.danger}33`,
                      }}>
                        {rejectLabel(q.status)}
                      </span>
                    )}
                    {isApproved && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, color: C.success, background: C.successLight, border: `1px solid ${C.success}33` }}>
                        ✓ 확인됨
                      </span>
                    )}
                  </div>

                  <p style={{ margin: "0 0 8px", fontSize: 14, color: C.text, fontWeight: 500, lineHeight: 1.6 }}>
                    {q.question_text}
                  </p>

                  {q.reason && (
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: C.textMuted, lineHeight: 1.5, borderLeft: `2px solid ${C.border}`, paddingLeft: 10 }}>
                      {q.reason}
                    </p>
                  )}
                  {q.rejected_reason && (
                    <p style={{ margin: 0, fontSize: 12, color: C.warning, lineHeight: 1.5, borderLeft: `2px solid ${C.warning}`, paddingLeft: 10, background: C.warningLight, borderRadius: "0 6px 6px 0", padding: "4px 10px" }}>
                      거절 이유: {q.rejected_reason}
                    </p>
                  )}
                </div>

                {/* 액션 바 */}
                <div style={{
                  padding: "10px 16px 12px", borderTop: `1px solid ${C.bg}`,
                  background: C.bg, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                }}>
                  {isRejected ? (
                    <button onClick={() => handleRestore(q)} disabled={isBusy}
                      style={{ ...btnBase, background: C.white, border: `1.5px solid ${C.border}`, color: C.text, opacity: isBusy ? 0.6 : 1 }}>
                      <IconRotate /> {isBusy ? "처리 중..." : "복구"}
                    </button>
                  ) : isApproved ? (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8, background: C.successLight, color: C.success, fontSize: 12, fontWeight: 700, border: `1.5px solid ${C.success}33` }}>
                        <IconCheck /> 확인됨
                      </span>
                      <div style={{ width: 1, height: 20, background: C.border }} />
                      <button onClick={() => handlePromote(q)} disabled={isBusy}
                        style={{ ...btnBase, background: C.white, border: `1.5px solid ${C.border}`, color: C.text, opacity: isBusy ? 0.6 : 1 }}>
                        <IconStar /> 공통질문 등록
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleReview(q)} disabled={isBusy}
                        style={{ ...btnBase, background: C.primary, color: C.white, opacity: isBusy ? 0.6 : 1 }}>
                        <IconCheck /> {isBusy ? "처리 중..." : "확인"}
                      </button>
                      <div style={{ width: 1, height: 20, background: C.border }} />
                      <button onClick={() => handlePromote(q)} disabled={isBusy}
                        style={{ ...btnBase, background: C.white, border: `1.5px solid ${C.border}`, color: C.text, opacity: isBusy ? 0.6 : 1 }}>
                        <IconStar /> {isMobile ? "공통등록" : "공통질문 등록"}
                      </button>
                      <button onClick={() => openRejectInput(q, "patient")} disabled={isBusy}
                        style={{ ...btnBase, color: C.warning, opacity: isBusy ? 0.6 : 1, background: showRejectPanel && rejectInput?.scope === "patient" ? C.warningLight : C.white, border: `1.5px solid ${C.warning}44` }}>
                        <IconEyeOff /> {isMobile ? "숨김" : "이 환자 숨김"}
                      </button>
                      <button onClick={() => openRejectInput(q, "global")} disabled={isBusy}
                        style={{ ...btnBase, color: C.danger, opacity: isBusy ? 0.6 : 1, background: showRejectPanel && rejectInput?.scope === "global" ? C.dangerLight : C.white, border: `1.5px solid ${C.danger}44` }}>
                        <IconGlobe /> {isMobile ? "전역거절" : "전역 거절"}
                      </button>
                    </>
                  )}
                </div>

                {/* 거절 입력 패널 */}
                {showRejectPanel && rejectInput && (
                  <div style={{
                    padding: "12px 16px 14px",
                    borderTop: `1px solid ${rejectInput.scope === "global" ? C.danger + "44" : C.warning + "44"}`,
                    background: rejectInput.scope === "global" ? C.dangerLight : C.warningLight,
                  }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: rejectInput.scope === "global" ? C.danger : C.warning }}>
                      {rejectInput.scope === "global" ? "전역 거절 이유" : "이 환자 숨김 이유"}
                      <span style={{ fontWeight: 400, color: C.textMuted }}> (선택)</span>
                    </p>
                    <textarea
                      value={rejectInput.text}
                      onChange={(e) => setRejectInput({ ...rejectInput, text: e.target.value })}
                      placeholder="이유를 입력하면 나중에 참고할 수 있어요."
                      rows={2}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "8px 12px", borderRadius: 8, fontSize: 13,
                        border: `1.5px solid ${C.border}`, resize: "vertical",
                        fontFamily: "inherit", color: C.text, outline: "none", lineHeight: 1.5,
                        background: C.white,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => handleReject(q)} disabled={isBusy}
                        style={{ ...btnBase, background: rejectInput.scope === "global" ? C.danger : C.warning, color: C.white, opacity: isBusy ? 0.6 : 1 }}>
                        {isBusy ? "처리 중..." : "거절 확정"}
                      </button>
                      <button onClick={() => setRejectInput(null)} disabled={isBusy}
                        style={{ ...btnBase, background: C.white, border: `1.5px solid ${C.border}`, color: C.text }}>
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 토스트 ── */}
      {toast.message && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1a1a2e", color: C.white, padding: "10px 20px", borderRadius: 10,
          fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          whiteSpace: "nowrap",
        }}>
          {toast.message}
        </div>
      )}
      {errToast.message && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.danger, color: C.white, padding: "10px 20px", borderRadius: 10,
          fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}>
          {errToast.message}
        </div>
      )}
    </main>
  );
}

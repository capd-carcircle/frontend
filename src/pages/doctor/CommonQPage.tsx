import React, { useEffect, useRef, useState } from "react";
import {
  CommonQuestion,
  QuestionType,
  createCommonQuestion,
  deleteCommonQuestion,
  listCommonQuestions,
  parseOptions,
  toggleCommonQuestion,
  updateCommonQuestion,
} from "../../api/questions";
import { COLOR, btn, card, table, typography } from "../../styles/doctor";

/* ── 아이콘 ────────────────────────────────────────────── */
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── 질문 유형 메타 ────────────────────────────────────── */
const TYPE_META: Record<QuestionType, { label: string; color: string; bg: string; desc: string }> = {
  yes_no:        { label: "예/아니오",  color: "#2563eb", bg: "#eff6ff", desc: "예 또는 아니오로 답변" },
  single_select: { label: "단일 선택",  color: "#7c3aed", bg: "#f5f3ff", desc: "선택지 중 하나 선택" },
  multi_select:  { label: "다중 선택",  color: "#0891b2", bg: "#ecfeff", desc: "선택지 중 여러 개 선택 가능" },
  short_text:    { label: "서술식",     color: "#059669", bg: "#ecfdf5", desc: "자유롭게 텍스트 입력" },
};

/* ── 공통 스타일 ────────────────────────────────────────── */
const iconBtn = (color: string, bgHover?: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 7,
  border: "none", background: bgHover ?? "transparent",
  cursor: "pointer", color, transition: "background 0.15s",
});

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: "8px 12px",
  border: `1.5px solid ${COLOR.grayLight}`,
  borderRadius: 7, outline: "none", color: COLOR.text,
  transition: "border-color 0.15s",
};

/* ── 선택지 에디터 컴포넌트 ─────────────────────────────── */
function OptionsEditor({ options, onChange }: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const addOption = () => onChange([...options, ""]);
  const removeOption = (idx: number) => onChange(options.filter((_, i) => i !== idx));
  const updateOption = (idx: number, val: string) =>
    onChange(options.map((o, i) => (i === idx ? val : o)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((opt, idx) => (
        <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            minWidth: 22, height: 22, borderRadius: "50%",
            backgroundColor: COLOR.primary, color: "#fff",
            fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>{idx + 1}</span>
          <input
            type="text"
            placeholder={`선택지 ${idx + 1}`}
            value={opt}
            onChange={(e) => updateOption(idx, e.target.value)}
            style={{ ...inputStyle, flex: 1, padding: "6px 10px" }}
            onFocus={(e) => (e.target.style.borderColor = COLOR.primary)}
            onBlur={(e) => (e.target.style.borderColor = COLOR.grayLight)}
          />
          <button
            type="button"
            title="선택지 삭제"
            style={iconBtn(COLOR.danger, "#fff1f2")}
            onClick={() => removeOption(idx)}
          >
            <IconX />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOption}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "none", border: `1.5px dashed ${COLOR.grayLight}`,
          borderRadius: 7, padding: "6px 12px", cursor: "pointer",
          fontSize: 12, color: COLOR.textMuted, marginTop: 2,
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget.style.borderColor = COLOR.primary);
          (e.currentTarget.style.color = COLOR.primary);
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style.borderColor = COLOR.grayLight);
          (e.currentTarget.style.color = COLOR.textMuted);
        }}
      >
        <IconPlus /> 선택지 추가
      </button>
    </div>
  );
}

/* ── 질문 폼 패널 (추가/수정 공용) ──────────────────────── */
function QuestionFormPanel({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { text: string; type: QuestionType; options: string[] };
  onSave: (data: { text: string; type: QuestionType; options: string[] }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [type, setType] = useState<QuestionType>(initial?.type ?? "yes_no");
  const [options, setOptions] = useState<string[]>(initial?.options ?? []);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  const isSelectType = type === "single_select" || type === "multi_select";
  const canSave =
    text.trim() !== "" &&
    (!isSelectType || options.filter((o) => o.trim()).length >= 2);

  const handleTypeChange = (t: QuestionType) => {
    setType(t);
    if (t !== "single_select" && t !== "multi_select") setOptions([]);
    else if (options.length === 0) setOptions(["", ""]);
  };

  const handleSubmit = async () => {
    if (!canSave || saving) return;
    await onSave({
      text: text.trim(),
      type,
      options: isSelectType ? options.filter((o) => o.trim()) : [],
    });
  };

  return (
    <div style={{
      ...card.base,
      border: `2px solid ${COLOR.primary}`,
      padding: 20, display: "flex", flexDirection: "column", gap: 16,
    }}>
      {/* 질문 내용 */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: COLOR.text, display: "block", marginBottom: 6 }}>
          질문 내용 <span style={{ color: COLOR.danger }}>*</span>
        </label>
        <input
          ref={textRef}
          type="text"
          placeholder="환자에게 표시될 질문을 입력하세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          onFocus={(e) => (e.target.style.borderColor = COLOR.primary)}
          onBlur={(e) => (e.target.style.borderColor = COLOR.grayLight)}
          disabled={saving}
        />
      </div>

      {/* 답변 유형 */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: COLOR.text, display: "block", marginBottom: 8 }}>
          답변 유형 <span style={{ color: COLOR.danger }}>*</span>
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(TYPE_META) as QuestionType[]).map((t) => {
            const meta = TYPE_META[t];
            const selected = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                title={meta.desc}
                style={{
                  padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                  border: `1.5px solid ${selected ? meta.color : COLOR.grayLight}`,
                  backgroundColor: selected ? meta.bg : "#fff",
                  color: selected ? meta.color : COLOR.textMuted,
                  boxShadow: selected ? `0 0 0 3px ${meta.bg}` : "none",
                }}
                disabled={saving}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 5 }}>
          {TYPE_META[type].desc}
          {type !== "short_text" && " · 환자가 비고란에 추가 텍스트를 입력할 수 있습니다"}
        </p>
      </div>

      {/* 선택지 (select 계열) */}
      {isSelectType && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: COLOR.text, display: "block", marginBottom: 8 }}>
            선택지 <span style={{ color: COLOR.danger }}>*</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: COLOR.textMuted, marginLeft: 6 }}>최소 2개 필요</span>
          </label>
          <OptionsEditor options={options} onChange={setOptions} />
        </div>
      )}

      {/* 버튼 */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{ ...btn.ghost, minWidth: 80 }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSave || saving}
          style={{ ...btn.primary, minWidth: 100, opacity: !canSave || saving ? 0.6 : 1 }}
        >
          {saving ? "저장 중..." : initial ? "수정 완료" : "질문 추가"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ */
export default function CommonQPage() {
  const [questions, setQuestions] = useState<CommonQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* 추가 폼 */
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  /* 수정 폼 */
  const [editId, setEditId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  /* ── 데이터 로드 ────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCommonQuestions();
      setQuestions(data);
    } catch {
      setError("질문 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ── 추가 ──────────────────────────────────────────── */
  const handleAdd = async ({ text, type, options }: { text: string; type: QuestionType; options: string[] }) => {
    setAddSaving(true);
    try {
      const created = await createCommonQuestion({
        question_text: text,
        question_type: type,
        options: options.length ? options : undefined,
      });
      setQuestions((prev) => [...prev, created]);
      setShowAddForm(false);
    } catch {
      alert("질문 추가에 실패했습니다.");
    } finally {
      setAddSaving(false);
    }
  };

  /* ── 수정 저장 ──────────────────────────────────────── */
  const handleEditSave = async ({ text, type, options }: { text: string; type: QuestionType; options: string[] }) => {
    if (editId === null) return;
    setEditSaving(true);
    try {
      const updated = await updateCommonQuestion(editId, {
        question_text: text,
        question_type: type,
        options: options.length ? options : [],
      });
      setQuestions((prev) => prev.map((q) => (q.id === editId ? updated : q)));
      setEditId(null);
    } catch {
      alert("수정에 실패했습니다.");
    } finally {
      setEditSaving(false);
    }
  };

  /* ── 삭제 ──────────────────────────────────────────── */
  const handleDelete = async (id: number, text: string) => {
    if (!window.confirm(`"${text.slice(0, 30)}${text.length > 30 ? "..." : ""}" 질문을 삭제할까요?`)) return;
    try {
      await deleteCommonQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  /* ── 활성/비활성 토글 ──────────────────────────────── */
  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleCommonQuestion(id);
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
    } catch {
      alert("상태 변경에 실패했습니다.");
    }
  };

  /* ── 통계 ──────────────────────────────────────────── */
  const activeCount   = questions.filter((q) => q.is_active).length;
  const inactiveCount = questions.length - activeCount;

  /* ════════════════════════════════════════════════════ */
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── 헤더 ── */}
      <div>
        <h1 style={typography.pageTitle}>공통 질문 관리</h1>
        <p style={typography.pageSubtitle}>모든 환자에게 공통으로 적용되는 후속 질문을 관리합니다.</p>
      </div>

      {/* ── 통계 배지 ── */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "전체", value: questions.length, color: COLOR.primary },
          { label: "활성", value: activeCount,       color: COLOR.success },
          { label: "비활성", value: inactiveCount,   color: COLOR.gray },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card.base, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 90 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
            <span style={{ fontSize: 11, color: COLOR.textMuted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── 추가 버튼 or 폼 ── */}
      {!showAddForm ? (
        <button
          style={{
            ...btn.primary,
            display: "flex", alignItems: "center", gap: 6,
            alignSelf: "flex-start", padding: "9px 18px",
          }}
          onClick={() => { setShowAddForm(true); setEditId(null); }}
        >
          <IconPlus /> 새 질문 추가
        </button>
      ) : (
        <QuestionFormPanel
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          saving={addSaving}
        />
      )}

      {/* ── 질문 목록 ── */}
      <div style={card.base}>
        {loading ? (
          <p style={{ textAlign: "center", color: COLOR.textMuted, fontSize: 12, padding: "30px 0" }}>불러오는 중...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: COLOR.danger, fontSize: 12, padding: "30px 0" }}>{error}</p>
        ) : questions.length === 0 ? (
          <p style={{ textAlign: "center", color: COLOR.textMuted, fontSize: 12, padding: "30px 0" }}>
            등록된 공통 질문이 없습니다. 위에서 추가해보세요.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* 테이블 헤더 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 100px 80px 110px",
              padding: "8px 14px",
              backgroundColor: "#f8f9fa",
              borderBottom: `1px solid ${COLOR.grayLight}`,
              borderRadius: "8px 8px 0 0",
            }}>
              {["#", "질문 내용", "유형", "상태", "작업"].map((h, i) => (
                <span key={h} style={{
                  fontSize: 11, fontWeight: 700, color: COLOR.textMuted, textTransform: "uppercase",
                  textAlign: i === 0 || i >= 2 ? "center" : "left",
                }}>{h}</span>
              ))}
            </div>

            {/* 질문 행 */}
            {questions.map((q, idx) => {
              const isEditing = editId === q.id;
              const meta = TYPE_META[q.question_type ?? "yes_no"];
              const opts = parseOptions(q.options);
              const rowBg = idx % 2 === 0 ? COLOR.white : COLOR.rowAlt;

              return (
                <React.Fragment key={q.id}>
                  {/* 수정 폼 */}
                  {isEditing ? (
                    <div style={{ padding: "12px 14px", backgroundColor: "#fafafa", borderBottom: `1px solid ${COLOR.grayLight}` }}>
                      <QuestionFormPanel
                        initial={{
                          text: q.question_text,
                          type: q.question_type ?? "yes_no",
                          options: opts,
                        }}
                        onSave={handleEditSave}
                        onCancel={() => setEditId(null)}
                        saving={editSaving}
                      />
                    </div>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 100px 80px 110px",
                      padding: "12px 14px",
                      backgroundColor: rowBg,
                      borderBottom: `1px solid ${COLOR.grayLight}`,
                      alignItems: "start",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f4ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowBg)}
                    >
                      {/* 번호 */}
                      <span style={{ fontSize: 11, color: COLOR.textMuted, textAlign: "center", paddingTop: 2 }}>
                        {idx + 1}
                      </span>

                      {/* 질문 내용 */}
                      <div>
                        <span style={{
                          fontSize: 13, color: q.is_active ? COLOR.text : COLOR.textMuted,
                          textDecoration: q.is_active ? "none" : "line-through",
                          lineHeight: 1.5,
                        }}>
                          {q.question_text}
                        </span>
                        {/* 선택지 미리보기 */}
                        {opts.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                            {opts.map((opt, i) => (
                              <span key={i} style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 20,
                                backgroundColor: "#f3f4f6", color: COLOR.textMuted,
                                border: `1px solid ${COLOR.grayLight}`,
                              }}>{opt}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 유형 배지 */}
                      <div style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-block", fontSize: 10, fontWeight: 700,
                          padding: "3px 9px", borderRadius: 20,
                          backgroundColor: meta.bg, color: meta.color,
                          border: `1px solid ${meta.color}22`,
                        }}>
                          {meta.label}
                        </span>
                      </div>

                      {/* 활성 상태 배지 */}
                      <div style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-block", fontSize: 10, fontWeight: 700,
                          padding: "3px 9px", borderRadius: 20,
                          backgroundColor: q.is_active ? "#edfff2" : "#f3f3f3",
                          color: q.is_active ? COLOR.success : COLOR.gray,
                        }}>
                          {q.is_active ? "활성" : "비활성"}
                        </span>
                      </div>

                      {/* 액션 버튼 */}
                      <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                        {/* 수정 */}
                        <button
                          title="수정"
                          style={iconBtn(COLOR.primary, "#eff6ff")}
                          onClick={() => { setEditId(q.id); setShowAddForm(false); }}
                        >
                          <IconEdit />
                        </button>
                        {/* 활성/비활성 토글 */}
                        <button
                          title={q.is_active ? "비활성화" : "활성화"}
                          style={iconBtn(q.is_active ? COLOR.gray : COLOR.success, q.is_active ? "#f3f3f3" : "#edfff2")}
                          onClick={() => handleToggle(q.id)}
                        >
                          {q.is_active ? <IconX /> : <IconCheck />}
                        </button>
                        {/* 삭제 */}
                        <button
                          title="삭제"
                          style={iconBtn(COLOR.danger, "#fff1f2")}
                          onClick={() => handleDelete(q.id, q.question_text)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

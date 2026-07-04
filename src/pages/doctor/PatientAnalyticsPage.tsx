/**
 * PatientAnalyticsPage — 환자 분석 리포트 (AB180 전환설계 9-2, 4단계)
 *
 * 데이터 소스: backend 온디맨드 analytics 엔드포인트
 *   GET /api/v1/analytics/patients/{patientId}?window=7|30|90
 * (설계상 최종 소스는 capd-analytics(Kotlin, Gold 읽기) 예정이지만 아직 미신설 —
 *  지금은 backend 온디맨드 계산 결과를 그대로 사용. 6단계에서 Kotlin 이관 시
 *  이 화면의 API 호출 대상만 바뀌고 화면 구조는 그대로 재사용 가능하도록 설계.)
 *
 * 섹션: ① 헤더(환자정보+기간선택) ② 추세 요약 카드 ③ 이상 탐지 ④ 요인 분석(상관관계)
 *       ⑤ 기간 비교(7일 대비 요약)
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import useAuthStore from "../../store/authStore";
import { calcAge, patientLabel } from "../../utils/helpers";
import { apiFetch } from "../../api/apiFetch";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  textLight:    '#9ca3af',
  success:      '#16a34a',
  successLight: '#f0fdf4',
  warning:      '#d97706',
  warningLight: '#fffbeb',
  danger:       '#dc2626',
  dangerLight:  '#fef2f2',
  white:        '#ffffff',
};

/* ── 지표 라벨/단위 ─────────────────────────────────────── */
const ATTR_LABEL: Record<string, string> = {
  body_weight_kg:          "체중",
  systolic_bp:              "수축기 혈압",
  diastolic_bp:             "이완기 혈압",
  mean_arterial_pressure:   "평균 동맥압",
  fasting_blood_sugar:      "공복 혈당",
  urination_count:          "배뇨 횟수",
  exchange_count:           "교환 횟수",
  dwell_mean_minutes:       "저류 시간(평균)",
  concentration_max:        "최고 농도",
  calculated_uf_sum_g:      "계산 제수량 합",
  recorded_uf_sum_g:        "기록 제수량 합",
  infused_sum_g:            "주입량 합",
  reported_total_uf_g:      "보고 총 제수량",
};

const ATTR_UNIT: Record<string, string> = {
  body_weight_kg: "kg", systolic_bp: "mmHg", diastolic_bp: "mmHg",
  mean_arterial_pressure: "mmHg", fasting_blood_sugar: "mg/dL",
  urination_count: "회", exchange_count: "회", dwell_mean_minutes: "분",
  concentration_max: "%", calculated_uf_sum_g: "g", recorded_uf_sum_g: "g",
  infused_sum_g: "g", reported_total_uf_g: "g",
};

function attrLabel(attr: string) { return ATTR_LABEL[attr] ?? attr; }
function attrUnit(attr: string)  { return ATTR_UNIT[attr] ?? ""; }

/* ── 추세 배지 ──────────────────────────────────────────── */
const TREND_CFG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  much_higher_than_baseline: { icon: "▲▲", color: C.danger,  bg: C.dangerLight,  label: "큰 폭 상승" },
  higher_than_baseline:      { icon: "▲",  color: C.warning, bg: C.warningLight, label: "상승" },
  stable:                    { icon: "─",  color: C.success, bg: C.successLight, label: "안정" },
  lower_than_baseline:       { icon: "▼",  color: C.warning, bg: C.warningLight, label: "하락" },
  much_lower_than_baseline:  { icon: "▼▼", color: C.danger,  bg: C.dangerLight,  label: "큰 폭 하락" },
  insufficient_data:         { icon: "?",  color: C.textLight, bg: '#f3f4f6',    label: "데이터 부족" },
};

function TrendBadge({ trend }: { trend: string }) {
  const cfg = TREND_CFG[trend] ?? TREND_CFG.insufficient_data;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

const ANOMALY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  strong_anomaly: { color: C.danger,  bg: C.dangerLight,  label: "강한 이상" },
  mild_anomaly:   { color: C.warning, bg: C.warningLight, label: "경미한 이상" },
  normal:         { color: C.success, bg: C.successLight, label: "정상" },
};

/* ── 타입 ─────────────────────────────────────────────── */
interface TrendEntry {
  today_value: number; unit: string;
  previous_30d_mean?: number; difference_from_30d_mean?: number; trend_30d?: string;
  previous_7d_mean?: number; difference_from_7d_mean?: number;
  percentage_change_from_7d_mean?: number | null; trend_7d?: string;
  trend_summary: string; statement: string;
}
interface AnomalyEntry {
  today_value: number; sufficient_data: boolean;
  baseline_mean?: number; baseline_std?: number;
  z_score_30d?: number; z_interpretation?: string;
  robust_z_score?: number; robust_interpretation?: string;
  is_anomaly?: boolean; statement: string;
}
interface CorrelationPair {
  attr1: string; attr2: string; correlation: number;
  direction: 'positive' | 'negative'; interpretation: string; statement: string;
}
interface AnalyticsResponse {
  patient_id: number; patient_name: string; record_date: string;
  window_days: number; source: string;
  trend_analysis:        { results: Record<string, TrendEntry> };
  anomaly_detection:      { results: Record<string, AnomalyEntry> };
  attribute_correlation:  { results: CorrelationPair[]; note?: string };
  eda:                    { results: Record<string, any> };
  has_anomaly: boolean; anomaly_attrs: string[];
}

/* ── 공통 카드 셸 ─────────────────────────────────────── */
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.border}`, padding: '18px 20px' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: C.textMuted, margin: '3px 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── 메인 ─────────────────────────────────────────────── */
export default function PatientAnalyticsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { patientName?: string; patientBirthDate?: string | null; patientGender?: string | null } | null;
  const passedName   = locState?.patientName ?? "";
  const passedBirth  = locState?.patientBirthDate ?? null;
  const passedGender = locState?.patientGender ?? null;

  const [window_, setWindow] = useState<7 | 30 | 90>(30);
  const [data, setData]     = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [notFound, setNotFound] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!patientId) return;
    const token = localStorage.getItem("access_token");
    if (!token) { navigate("/login"); return; }

    setLoading(true);
    setError("");
    setNotFound(false);
    apiFetch(`${API}/api/v1/analytics/patients/${patientId}?window=${window_}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) { useAuthStore.getState().logout(); navigate("/login"); return null; }
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) throw new Error("서버 오류");
        return res.json();
      })
      .then((json: AnalyticsResponse | null) => { if (json) setData(json); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId, window_, navigate]);

  const patientName = data?.patient_name ?? passedName;
  const displayName = patientLabel(patientName, passedBirth, passedGender);
  const age = passedBirth ? calcAge(passedBirth) : null;

  const trendResults = data ? Object.entries(data.trend_analysis.results) : [];
  const anomalyResults = data ? Object.entries(data.anomaly_detection.results) : [];
  const corrPairs = data?.attribute_correlation.results ?? [];

  return (
    <main style={{
      flex: 1, overflowY: "auto",
      padding: isMobile ? '16px' : '28px 32px',
      display: 'flex', flexDirection: 'column', gap: 16,
      background: C.bg,
    }}>
      {/* ── 헤더 ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.04em' }}>
            {displayName || "환자"} 분석 리포트
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '3px 0 0' }}>
            {data ? `${data.record_date} 기준 · 과거 ${data.window_days}일 데이터 반영` : "추세 · 이상 탐지 · 상관관계 분석"}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: "6px 16px", borderRadius: 20,
            border: `0.5px solid ${C.border}`, background: C.white,
            color: C.textMuted, fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.textMuted }}
        >
          ← 뒤로
        </button>
      </div>

      {/* ── 기간 선택 ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([7, 30, 90] as const).map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              border: `0.5px solid ${w === window_ ? C.primary : C.border}`,
              background: w === window_ ? C.primary : C.white,
              color: w === window_ ? C.white : C.textMuted,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            최근 {w}일
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 48, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>불러오는 중...</div>
      )}
      {error && (
        <div style={{ padding: 48, textAlign: 'center', color: C.danger, fontSize: 13 }}>오류: {error}</div>
      )}
      {notFound && !loading && (
        <div style={{ background: C.white, borderRadius: 12, border: `0.5px solid ${C.border}`, textAlign: "center", color: C.textMuted, fontSize: 13, padding: 48 }}>
          분석할 제출/승인 기록이 없습니다. 환자가 기록을 제출하면 리포트가 생성됩니다.
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── 이상치 경고 배너 ── */}
          {data.has_anomaly && (
            <div style={{
              background: C.dangerLight, border: `0.5px solid #fecaca`, borderRadius: 12,
              padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>🚨</span>
              <span style={{ fontSize: 13, color: C.danger, fontWeight: 600 }}>
                오늘 기록에서 이상 소견이 감지됐어요: {data.anomaly_attrs.map(attrLabel).join(', ')}
              </span>
            </div>
          )}

          {/* ── ② 추세 요약 카드 ── */}
          <SectionCard title="추세 요약" subtitle="오늘 값이 7일·30일 평균 대비 어떻게 변했는지">
            {trendResults.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>표시할 추세 데이터가 없습니다.</div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 12,
              }}>
                {trendResults.map(([attr, entry]) => (
                  <div key={attr} style={{
                    border: `0.5px solid ${C.border}`, borderRadius: 10, padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{attrLabel(attr)}</span>
                      <TrendBadge trend={entry.trend_summary} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                      {entry.today_value} <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{entry.unit}</span>
                    </div>
                    {entry.percentage_change_from_7d_mean != null && (
                      <div style={{ fontSize: 11, color: C.textMuted }}>
                        7일 평균 대비 {entry.percentage_change_from_7d_mean > 0 ? '+' : ''}{entry.percentage_change_from_7d_mean}%
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.textLight, lineHeight: 1.5 }}>{entry.statement}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── ③ 이상 탐지 ── */}
          <SectionCard title="이상 탐지" subtitle="30일 데이터 기준 z-score / robust z-score">
            {anomalyResults.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>표시할 이상탐지 데이터가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {anomalyResults
                  .slice()
                  .sort((a, b) => Number(!!b[1].is_anomaly) - Number(!!a[1].is_anomaly))
                  .map(([attr, entry]) => {
                    const level = entry.z_interpretation && entry.z_interpretation !== 'normal'
                      ? entry.z_interpretation
                      : (entry.robust_interpretation ?? 'normal');
                    const cfg = ANOMALY_CFG[level] ?? ANOMALY_CFG.normal;
                    return (
                      <div key={attr} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        padding: '10px 14px', borderRadius: 10,
                        background: entry.is_anomaly ? cfg.bg : C.bg,
                        border: `0.5px solid ${entry.is_anomaly ? cfg.color + '33' : C.border}`,
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{attrLabel(attr)}</span>
                          <span style={{ fontSize: 11, color: C.textMuted }}>{entry.statement}</span>
                        </div>
                        {entry.sufficient_data ? (
                          <span style={{
                            flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                            color: cfg.color, background: cfg.bg,
                          }}>
                            {cfg.label}{entry.z_score_30d != null ? ` (z=${entry.z_score_30d})` : ''}
                          </span>
                        ) : (
                          <span style={{ flexShrink: 0, fontSize: 11, color: C.textLight }}>데이터 부족</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </SectionCard>

          {/* ── ④ 요인 분석(상관관계) ── */}
          <SectionCard title="요인 분석" subtitle="Spearman 상관계수 |r| ≥ 0.5 쌍만 표시">
            {corrPairs.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
                {data.attribute_correlation.note ?? '유의미한 상관관계가 없습니다.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {corrPairs.map((p, i) => {
                  const pct = Math.round(Math.abs(p.correlation) * 100);
                  const barColor = p.direction === 'positive' ? C.primary : C.danger;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: C.text, fontWeight: 600 }}>
                          {attrLabel(p.attr1)} ↔ {attrLabel(p.attr2)}
                        </span>
                        <span style={{ color: C.textMuted }}>
                          {p.correlation} ({p.interpretation}, {p.direction === 'positive' ? '양의 상관' : '음의 상관'})
                        </span>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 6 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* ── ⑤ 기간 비교 (7일 대비) ── */}
          <SectionCard title="기간 비교" subtitle="최근 7일 평균 대비 오늘">
            {trendResults.filter(([, e]) => e.previous_7d_mean != null).length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>비교할 7일 데이터가 없습니다.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {trendResults
                  .filter(([, e]) => e.previous_7d_mean != null)
                  .map(([attr, e]) => (
                    <div key={attr} style={{ padding: '10px 14px', borderRadius: 10, border: `0.5px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{attrLabel(attr)}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{e.today_value}{attrUnit(attr)}</span>
                        <span style={{ fontSize: 11, color: C.textLight }}>← 7일평균 {e.previous_7d_mean}{attrUnit(attr)}</span>
                      </div>
                      {e.trend_7d && <div style={{ marginTop: 4 }}><TrendBadge trend={e.trend_7d} /></div>}
                    </div>
                  ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </main>
  );
}

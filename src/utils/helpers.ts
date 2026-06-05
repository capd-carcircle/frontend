/** 전화번호 하이픈 포맷 — 01012345678 → 010-1234-5678 */
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

/**
 * 만 나이(숫자) 계산 — null 반환 시 생년월일 미입력
 * @param birth_date  'YYYY-MM-DD'
 * @param refDate     기준일 (생략 시 오늘), 기록 날짜 기준 나이 계산에 활용
 */
export function calcAge(birth_date: string | null, refDate?: string | null): number | null {
  if (!birth_date) return null
  const ref   = refDate ? new Date(refDate + 'T00:00:00') : new Date()
  const birth = new Date(birth_date + 'T00:00:00')
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return age
}

/**
 * 환자 표시 이름 — "홍길동(만36세/남)" 형식
 */
export function patientLabel(
  name: string,
  birth_date: string | null,
  gender: string | null,
  refDate?: string | null,
): string {
  const age = calcAge(birth_date, refDate)
  const g = gender === 'm' ? '남' : gender === 'f' ? '여' : null
  if (age !== null && g) return `${name}(만${age}세/${g})`
  if (age !== null) return `${name}(만${age}세)`
  if (g) return `${name}(${g})`
  return name
}

/** 만 나이 표시 — "만N세" */
export function formatAge(birthDate: string | undefined | null, referenceDate?: string): string {
  if (!birthDate) return '—'
  const birth = new Date(birthDate)
  const ref = referenceDate ? new Date(referenceDate) : new Date()
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return `만${age}세`
}

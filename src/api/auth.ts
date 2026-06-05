import client from './client'
import type { TokenResponse, User, Hospital, DoctorSummary, PatientRegistrationInfo } from '../types'

/**
 * 로그인 → { access_token, refresh_token, user_id, name, role }
 */
export async function login(phone_number: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/api/v1/auth/login', { phone_number, password })
  return data
}

/**
 * refresh_token → 새 access_token 발급
 */
export async function refreshAccessToken(refresh_token: string): Promise<{ access_token: string }> {
  const { data } = await client.post<{ access_token: string }>('/api/v1/auth/refresh', { refresh_token })
  return data
}

/**
 * 서버 측 refresh token 무효화 (로그아웃)
 */
export async function logoutApi(): Promise<void> {
  await client.post('/api/v1/auth/logout')
}

/**
 * 현재 로그인 유저 정보 조회
 */
export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/api/v1/auth/me')
  return data
}

// ── 회원가입 공통 ──────────────────────────────────────────

export async function getHospitals(): Promise<Hospital[]> {
  const { data } = await client.get<Hospital[]>('/api/v1/registration/hospitals')
  return data
}

export async function getDoctors(hospital_id?: number): Promise<DoctorSummary[]> {
  const params = hospital_id ? { hospital_id } : {}
  const { data } = await client.get<DoctorSummary[]>('/api/v1/registration/doctors', { params })
  return data
}

// ── 의사 가입 ──────────────────────────────────────────────

export async function doctorVerify(payload: {
  name: string
  birth_date: string
  license_number: string
  hospital_id: number
}): Promise<{ verify_token: string; name: string; hospital_id: number; license_number: string }> {
  const { data } = await client.post('/api/v1/registration/doctor/verify', payload)
  return data
}

export async function doctorComplete(payload: {
  phone_number: string
  password: string
  verify_token: string
}): Promise<void> {
  await client.post('/api/v1/registration/doctor/complete', payload)
}

// ── 환자 가입 (즉시 가입, 의사 승인 없음) ────────────────────

export async function patientRequest(payload: {
  name: string
  birth_date: string
  hospital_id?: number
  phone_number: string
  password: string
  gender: string
  address?: string
}): Promise<{ user_id: number }> {
  const { data } = await client.post('/api/v1/registration/patient/request', payload)
  return data
}

// ── 환자: 담당 의사 연결 신청 (로그인 후) ────────────────────

export async function patientConnectRequest(doctor_id: number): Promise<{ registration_id: number }> {
  const { data } = await client.post('/api/v1/registration/patient/connect-request', { doctor_id })
  return data
}

export async function getMyPendingRequest(): Promise<{
  request: { id: number; request_type: string; doctor_name: string | null; status: string } | null
}> {
  const { data } = await client.get('/api/v1/registration/patient/my-request')
  return data
}

export async function cancelMyRequest(registration_id: number): Promise<void> {
  await client.delete(`/api/v1/registration/patient/request/${registration_id}`)
}

export async function patientDischargeRequest(reason?: string): Promise<{ registration_id: number }> {
  const { data } = await client.post('/api/v1/registration/patient/discharge-request', { reason })
  return data
}

export async function getRegistrationStatus(registration_id: number): Promise<{
  registration_id: number
  status: string
  reject_reason: string | null
}> {
  const { data } = await client.get(`/api/v1/registration/patient/status/${registration_id}`)
  return data
}

// ── 의사용: 환자 가입 승인/거절 ────────────────────────────

export async function getPendingRegistrations(): Promise<PatientRegistrationInfo[]> {
  const { data } = await client.get<PatientRegistrationInfo[]>('/api/v1/registration/doctor/pending')
  return data
}

export async function approveRegistration(registration_id: number): Promise<void> {
  await client.post('/api/v1/registration/doctor/approve', { registration_id })
}

export async function rejectRegistration(registration_id: number, reason?: string): Promise<void> {
  await client.post('/api/v1/registration/doctor/reject', { registration_id, reason })
}

// ── 의사용: 인수인계 ────────────────────────────────────────

export async function handoverPatient(patient_id: number, new_doctor_id: number): Promise<{ message: string; new_doctor_name: string }> {
  const { data } = await client.post(`/api/v1/patients/${patient_id}/handover`, { new_doctor_id })
  return data
}

import { create } from 'zustand'
import axios from 'axios'
import type { User, UserRole } from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface AuthState {
  user: User | null
  isLoading: boolean
  isHydrated: boolean
  error: string | null
  login: (phone_number: string, password: string, autoLogin: boolean) => Promise<UserRole>
  logout: () => void
  restoreUser: (user: User) => void
  hydrateAuth: () => Promise<void>
}

// 토큰은 항상 localStorage에 저장.
// 자동로그인 OFF → session_only=true 플래그 세팅.
// hydrateAuth 시 session_only=true이고 session_active(sessionStorage)가 없으면 → 브라우저 재시작으로 판단해 토큰 삭제.

/** JWT payload의 sub(user_id)를 서명 검증 없이 파싱 (클라이언트 식별용) */
function parseJwtUserId(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const id = parseInt(payload.sub, 10)
    return isNaN(id) ? 0 : id
  } catch {
    return 0
  }
}

function clearAllTokens() {
  ['access_token', 'refresh_token', 'user_name', 'user_role', 'session_only'].forEach(k =>
    localStorage.removeItem(k),
  )
  sessionStorage.removeItem('session_active')
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isHydrated: false,
  error: null,

  // 앱 시작 시 refresh_token으로 세션 복원
  hydrateAuth: async () => {
    const sessionOnly = localStorage.getItem('session_only') === 'true'
    const sessionActive = sessionStorage.getItem('session_active') === 'true'

    // 자동로그인 OFF + 브라우저 재시작 → 토큰 삭제
    if (sessionOnly && !sessionActive) {
      clearAllTokens()
      set({ isHydrated: true })
      return
    }

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      set({ isHydrated: true })
      return
    }

    // 현재 세션 활성 마킹
    sessionStorage.setItem('session_active', 'true')

    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/v1/auth/refresh`,
        { refresh_token: refreshToken },
      )
      localStorage.setItem('access_token', data.access_token)
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)

      const name = localStorage.getItem('user_name') ?? ''
      const role = localStorage.getItem('user_role') as UserRole | null
      const userId = parseJwtUserId(data.access_token)
      set({
        user: role ? { id: userId, name, role, doctor_id: null } : null,
        isHydrated: true,
      })
    } catch {
      clearAllTokens()
      set({ isHydrated: true })
    }
  },

  login: async (phone_number, password, autoLogin) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await axios.post(`${BASE_URL}/api/v1/auth/login`, { phone_number, password })
      clearAllTokens()
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_name', data.name)
      localStorage.setItem('user_role', data.role)
      if (!autoLogin) localStorage.setItem('session_only', 'true')
      sessionStorage.setItem('session_active', 'true')
      set({
        user: { id: data.user_id, name: data.name, role: data.role, doctor_id: null },
        isLoading: false,
      })
      return data.role
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : '로그인에 실패했습니다.'
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  logout: () => {
    clearAllTokens()
    set({ user: null, error: null })
  },

  restoreUser: (user: User) => set({ user }),
}))

export default useAuthStore

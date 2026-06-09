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

// 자동로그인 여부에 따라 저장 위치 결정
function getAutoStorage(): Storage {
  return localStorage.getItem('auto_login') === 'true' ? localStorage : sessionStorage
}

// 두 스토리지 중 하나에서 값 읽기
export function getStoredToken(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function clearAllTokens() {
  const keys = ['access_token', 'refresh_token', 'user_name', 'user_role']
  keys.forEach(k => {
    localStorage.removeItem(k)
    sessionStorage.removeItem(k)
  })
  localStorage.removeItem('auto_login')
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isHydrated: false,
  error: null,

  // 앱 시작 시 refresh_token으로 세션 복원
  hydrateAuth: async () => {
    const refreshToken = getStoredToken('refresh_token')
    if (!refreshToken) {
      set({ isHydrated: true })
      return
    }
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/v1/auth/refresh`,
        { refresh_token: refreshToken },
      )
      const storage = getAutoStorage()
      storage.setItem('access_token', data.access_token)
      if (data.refresh_token) storage.setItem('refresh_token', data.refresh_token)

      const name = getStoredToken('user_name') ?? ''
      const role = getStoredToken('user_role') as UserRole | null
      set({
        user: role ? { id: 0, name, role, doctor_id: null } : null,
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
      // 다른 role로 로그인 시 기존 세션 완전 초기화
      clearAllTokens()
      const storage = autoLogin ? localStorage : sessionStorage
      storage.setItem('access_token', data.access_token)
      storage.setItem('refresh_token', data.refresh_token)
      storage.setItem('user_name', data.name)
      storage.setItem('user_role', data.role)
      if (autoLogin) localStorage.setItem('auto_login', 'true')
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

  // 페이지 새로고침 후 토큰으로 유저 복원
  restoreUser: (user: User) => set({ user }),
}))

export default useAuthStore

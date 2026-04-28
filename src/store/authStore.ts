import { create } from 'zustand'
import { login as apiLogin } from '../api/auth'
import type { User, UserRole } from '../types'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  login: (phone_number: string, password: string) => Promise<UserRole>
  logout: () => void
  restoreUser: (user: User) => void
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (phone_number, password) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiLogin(phone_number, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user_name', data.name)
      localStorage.setItem('user_role', data.role)
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
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_name')
    localStorage.removeItem('user_role')
    set({ user: null, error: null })
  },

  // 페이지 새로고침 후 토큰으로 유저 복원
  restoreUser: (user: User) => set({ user }),
}))

export default useAuthStore

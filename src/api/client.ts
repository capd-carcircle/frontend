import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// 요청 인터셉터: JWT 토큰 자동 첨부
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// refresh 진행 중 여부 & 대기 큐 (동시 요청 중복 refresh 방지)
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

function processQueue(newToken: string) {
  refreshQueue.forEach(resolve => resolve(newToken))
  refreshQueue = []
}

function forceLogout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_role')
  window.location.href = '/login'
}

// 응답 인터셉터: 401 → refresh 시도 → 성공 시 원래 요청 재시도, 실패 시 로그아웃
client.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: unknown) => {
    const axiosError = error as { response?: { status?: number }; config?: InternalAxiosRequestConfig & { _retry?: boolean } }

    if (axiosError.response?.status !== 401 || axiosError.config?._retry) {
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      forceLogout()
      return Promise.reject(error)
    }

    // 이미 refresh 중이면 큐에 대기
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((newToken: string) => {
          if (!axiosError.config) { reject(error); return }
          axiosError.config._retry = true
          axiosError.config.headers.Authorization = `Bearer ${newToken}`
          resolve(client(axiosError.config))
        })
      })
    }

    isRefreshing = true
    axiosError.config!._retry = true

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/auth/refresh`,
        { refresh_token: refreshToken },
      )
      const newAccessToken: string = data.access_token
      localStorage.setItem('access_token', newAccessToken)
      processQueue(newAccessToken)
      axiosError.config!.headers.Authorization = `Bearer ${newAccessToken}`
      return client(axiosError.config!)
    } catch {
      forceLogout()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)

export default client

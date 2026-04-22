import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error } = useAuthStore()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const role = await login(phone, password)
      if (role === 'doctor') navigate('/doctor')
      else navigate('/patient')
    } catch {
      // 에러는 store에서 처리
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* 로고 / 타이틀 */}
        <div className={styles.header}>
          <h1 className={styles.title}>CAPD</h1>
          <p className={styles.subtitle}>복막투석 일일 기록 관리 시스템</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="phone">전화번호</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              placeholder="전화번호를 입력하세요 (예: 01012345678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.button}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link
            to="/register"
            style={{ color: '#4A7FFF', fontSize: '14px', textDecoration: 'none' }}
          >
            계정이 없으신가요? 회원가입
          </Link>
        </div>

        {/* 개발용 테스트 계정 안내 */}
        <div className={styles.devNote}>
          <p>테스트 계정</p>
          <p>의사: 01011112222 / test1234</p>
          <p>환자: 01033334444 / test1234</p>
        </div>
      </div>
    </div>
  )
}

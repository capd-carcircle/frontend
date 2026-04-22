/**
 * RegisterPage — 가입 역할 선택 (의사 / 환자)
 */
import { useNavigate } from 'react-router-dom'
import styles from './LoginPage.module.css'

export default function RegisterPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>CAPD</h1>
          <p className={styles.subtitle}>회원가입</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <button
            className={styles.button}
            onClick={() => navigate('/register/doctor')}
            style={{ backgroundColor: '#2563EB' }}
          >
            의사로 가입하기
          </button>
          <button
            className={styles.button}
            onClick={() => navigate('/register/patient')}
            style={{ backgroundColor: '#059669' }}
          >
            환자로 가입하기
          </button>
          <button
            className={styles.button}
            onClick={() => navigate('/login')}
            style={{ backgroundColor: '#6B7280' }}
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}

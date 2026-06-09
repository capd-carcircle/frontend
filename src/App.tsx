import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import useAuthStore from './store/authStore'

export default function App() {
  const hydrateAuth = useAuthStore(s => s.hydrateAuth)

  useEffect(() => {
    hydrateAuth()
  }, [hydrateAuth])

  return <RouterProvider router={router} />
}

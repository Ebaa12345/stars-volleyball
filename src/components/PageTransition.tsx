import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(false)
    const t = setTimeout(() => setShow(true), 40)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div className={`page-transition ${show ? 'visible' : ''}`}>
      {children}
    </div>
  )
}

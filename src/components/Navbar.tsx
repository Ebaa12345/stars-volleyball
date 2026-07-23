import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Menu, X, Award, LogOut, User, Stars } from 'lucide-react'

export default function Navbar() {
  const { user, profile, signOut, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  const navLinks = [
    { to: '/', label: 'Нүүр' },
    { to: '/about', label: 'Бидний тухай' },
    { to: '/team', label: 'Team' },
    { to: '/contact', label: 'Холбоо барих' },
  ]

  const isActive = (path: string) => loc.pathname === path

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <Stars size={28} />
          <span>Stars Club</span>
        </Link>

        <div className="nav-links desktop">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="nav-actions desktop">
          {user ? (
            <>
              {!isAdmin && (
                <>
                  <Link to="/schedule" className={`nav-link ${isActive('/schedule') ? 'active' : ''}`}>Хуваарь</Link>
                  <Link to="/report" className={`nav-link ${isActive('/report') ? 'active' : ''}`}>Тайлан</Link>
                </>
              )}
              {isAdmin && (
                <>
                  <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>Admin</Link>
                  <Link to="/report" className={`nav-link ${isActive('/report') ? 'active' : ''}`}>Тайлан</Link>
                </>
              )}
              <Link to={isAdmin ? '/admin' : '/schedule'} className="nav-btn-ghost">
                <User size={16} />
                {profile?.full_name?.split(' ')[0] || 'Профайл'}
              </Link>
              <button onClick={signOut} className="nav-btn-outline">
                <LogOut size={16} /> Гарах
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-btn-primary">Нэвтрэх</Link>
              
            </>
          )}
        </div>

        <button
          className={`hamburger${open ? ' open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Цэс хаах' : 'Цэс нээх'}
          aria-expanded={open}
        >
          <span className="hamburger-icon">
            <Menu size={24} className="icon-menu" />
            <X size={24} className="icon-close" />
          </span>
        </button>
      </div>

      {/* Үргэлж DOM-д байдаг (зөвхөн "open" класс нь grid-template-rows-ийг
          сольдог) — эс тэгвээс React {open && ...} шиг шууд mount/unmount
          хийвэл хаагдах үеийн animation ажиллах боломжгүй байсан. */}
      <div className={`mobile-menu-wrap${open ? ' open' : ''}`}>
        <div className="mobile-menu">
          <div className="mobile-menu-inner">
            {navLinks.map((link, i) => (
              <Link
                key={link.to}
                to={link.to}
                className="mobile-link"
                style={{ transitionDelay: open ? `${i * 40}ms` : '0ms' }}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mobile-divider" />
            {user ? (
              <>
                <Link
                  to={isAdmin ? '/admin' : '/schedule'}
                  className="mobile-link"
                  style={{ transitionDelay: open ? `${navLinks.length * 40}ms` : '0ms' }}
                  onClick={() => setOpen(false)}
                >
                  {isAdmin ? 'Admin' : 'Хуваарь'}
                </Link>
                <Link
                  to="/report"
                  className="mobile-link"
                  style={{ transitionDelay: open ? `${(navLinks.length + 1) * 40}ms` : '0ms' }}
                  onClick={() => setOpen(false)}
                >
                  Тайлан
                </Link>
                <button
                  onClick={() => { signOut(); setOpen(false) }}
                  className="mobile-link logout"
                  style={{ transitionDelay: open ? `${(navLinks.length + 2) * 40}ms` : '0ms' }}
                >
                  Гарах
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="mobile-link highlight"
                style={{ transitionDelay: open ? `${navLinks.length * 40}ms` : '0ms' }}
                onClick={() => setOpen(false)}
              >
                Нэвтрэх
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

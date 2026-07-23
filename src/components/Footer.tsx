import { Link } from 'react-router-dom'
import { Stars, MapPin, Phone, Facebook, Instagram, ChevronRight, ArrowUp } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-glow" aria-hidden="true" />
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <Stars size={22} />
            <span>Stars Club</span>
          </Link>
          <p>Монголын шилдэг волейбол клуб. Хүч, хурд, нэгдмэл байдал — бид нэг хэмнэлд тоглодог.</p>
          <div className="footer-social">
            <a
              href="https://www.facebook.com/share/1DEA1YPbnn/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <Facebook size={18} />
            </a>
            <a
              href="https://www.instagram.com/stars_volleyballclub"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h4>Холбоос</h4>
          <Link to="/">Нүүр</Link>
          <Link to="/about">Бидний тухай</Link>
          <Link to="/team">Team</Link>
        </div>

        <div className="footer-col">
          <h4>Холбоо барих</h4>
          <a href="tel:+97699648404" className="footer-contact-item">
            <Phone size={15} /> +976 9964-8404
          </a>
          <span className="footer-contact-item">
            <MapPin size={15} /> Улаанбаатар, Баянзүрх дүүрэг
          </span>
          <Link to="/contact" className="footer-cta-link">
            Зурвас илгээх <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <span>© {year} Stars Volleyball Club. Бүх эрх хуулиар хамгаалагдсан.</span>
          <button
            type="button"
            className="footer-top-btn"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Дээш буцах"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </footer>
  )
}

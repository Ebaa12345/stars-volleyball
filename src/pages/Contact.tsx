import { useState } from 'react'
import { MapPin, Phone, Send, Facebook, Instagram } from 'lucide-react'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: wire to Supabase or email service
    setSent(true)
  }

  const contactData = [
    { icon: MapPin, label: 'Хаяг', value: 'Улаанбаатар, Баянзүрх дүүрэг' },
    { icon: Phone, label: 'Утас', value: '+976 9900-0000' },
    { icon: Facebook, label: 'Facebook', value: 'Stars Club', link: 'https://www.facebook.com/share/1DEA1YPbnn/?mibextid=wwXIfr' },
    { icon: Instagram, label: 'Instagram', value: 'Stars Club', link: 'https://www.instagram.com/stars_volleyballclub' },
  ]

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">Холбоо барих</span>
          <h1>Бидэнтэй холбогдох</h1>
          <p>Асуулт, санал хүсэлтийг чөлөөтэй илгээгээрэй.</p>
        </div>

        <div className="contact-layout">
          <div className="contact-info">
            <h2>Хаяг мэдээлэл</h2>
            {contactData.map(({ icon: Icon, label, value, link }) => {
              // Хэрэв линктэй (Facebook, Instagram) бол дарагддаг <a> тег харуулна
              if (link) {
                return (
                  <a 
                    key={label} 
                    href={link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="contact-item contact-item-link"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                  >
                    <div className="contact-icon"><Icon size={20} /></div>
                    <div>
                      <span className="contact-label" style={{ color: 'var(--orange, #ff7a00)' }}>{label}</span>
                      <p style={{ margin: 0 }}>{value}</p>
                    </div>
                  </a>
                )
              }

              // Линкгүй бол (Хаяг, Утас) энгийн div хэвээрээ байна
              return (
                <div key={label} className="contact-item">
                  <div className="contact-icon"><Icon size={20} /></div>
                  <div>
                    <span className="contact-label">{label}</span>
                    <p>{value}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="contact-form-wrap">
            {sent ? (
              <div className="success-msg">
                <span>✓</span>
                <h3>Амжилттай илгээлээ!</h3>
                <p>Тантай удахгүй холбогдоно.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="form-group">
                  <label>Нэр</label>
                  <input
                    type="text"
                    placeholder="Таны нэр"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>И-мэйл</label>
                  <input
                    type="email"
                    placeholder="sk21d032@student.humanities.mn"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Мэдээлэл</label>
                  <textarea
                    rows={5}
                    placeholder="Таны асуулт, санал..."
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary">
                  <Send size={16} /> Илгээх
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
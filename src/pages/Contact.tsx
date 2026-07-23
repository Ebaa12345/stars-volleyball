import { useState } from 'react'
import { MapPin, Phone, Send, Facebook, Instagram } from 'lucide-react'
import emailjs from '@emailjs/browser'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════════════════════════
// EmailJS тохиргоо — доорх 3 утгыг ӨӨРИЙН EmailJS акаунтаас аваад
// солино уу (backend/Edge Function шаардахгүй, шууд client-с и-мэйл явна):
//
//   1. https://www.emailjs.com дээр (үнэгүй) бүртгүүлнэ.
//   2. "Email Services" хэсэгт очиж Gmail (эсвэл өөр) акаунтаа холбоно
//      → үүнээс гарах SERVICE_ID-г доор тавина.
//   3. "Email Templates" хэсэгт шинэ template үүсгэнэ. Template-ийн бие
//      дотор {{from_name}}, {{from_email}}, {{message}} гэсэн variable-үүдийг
//      ашиглана (жишээ нь: "Илгээгч: {{from_name}} ({{from_email}})\n\n{{message}}")
//      → үүнээс гарах TEMPLATE_ID-г доор тавина.
//   4. "Account" → "General" хэсгээс Public Key-г аваад доор тавина.
//
// Гурвыг нь бөглөсний дараа санал хүсэлтийн формоос илгээсэн зурвас
// шууд таны и-мэйл рүү очно.
// ══════════════════════════════════════════════════════════════════
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID'
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSending(true)

    // Хоёр сувгаар зэрэг явуулна: (1) EmailJS-ээр бодит и-мэйл рүү,
    // (2) Supabase-д хадгалж Admin панелийн "Санал хүсэлт" таб-д харагдуулна.
    // Аль нэг нь тохируулагдаагүй/алдаатай байсан ч нөгөө нь ажиллавал
    // мессеж алдагдахгүй байхаар Promise.allSettled ашиглав.
    const emailConfigured = EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID'

    const [emailResult, dbResult] = await Promise.allSettled([
      emailConfigured
        ? emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            { from_name: form.name, from_email: form.email, message: form.message },
            { publicKey: EMAILJS_PUBLIC_KEY }
          )
        : Promise.reject(new Error('EmailJS тохируулагдаагүй')),
      supabase.from('contact_messages').insert({ name: form.name, email: form.email, message: form.message }),
    ])

    const dbOk = dbResult.status === 'fulfilled' && !(dbResult.value as any)?.error
    const emailOk = emailResult.status === 'fulfilled'

    if (dbOk || emailOk) {
      setSent(true)
      setForm({ name: '', email: '', message: '' })
    } else {
      setErrorMsg('Илгээхэд алдаа гарлаа. Дахин оролдоно уу.')
    }
    setSending(false)
  }

  const contactData = [
    { icon: MapPin, label: 'Хаяг', value: 'Улаанбаатар, Баянзүрх дүүрэг' },
    { icon: Phone, label: 'Утас', value: '+976 9964-8404' },
    { icon: Facebook, label: 'Facebook', value: 'Stars Club', link: 'https://www.facebook.com/share/1DEA1YPbnn/?mibextid=wwXIfr' },
    { icon: Instagram, label: 'Instagram', value: 'Stars Club', link: 'https://www.instagram.com/stars_volleyballclub' },
  ]

  return (
    <div className="page contact-page">
      <div className="contact-glow" aria-hidden="true" />
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
                    placeholder="Mail"
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
                {errorMsg && (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0 0 4px 0' }}>{errorMsg}</p>
                )}
                <button type="submit" className="btn-primary" disabled={sending}>
                  <Send size={16} /> {sending ? 'Илгээж байна...' : 'Илгээх'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Award, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function SetPassword() {
  const navigate = useNavigate()
  const { isAdmin, profile } = useAuth()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Supabase-ийн линк дарахад access_token-той хамт session автоматаар тохирно
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Нууц үг таарахгүй байна.')
      return
    }
    if (form.password.length < 6) {
      setError('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой.')
      return
    }

    setLoading(true)
    setError('')

    const { error: passErr } = await supabase.auth.updateUser({ password: form.password })

    if (passErr) {
      setError(passErr.message || 'Алдаа гарлаа. Дахин оролдоно уу.')
      setLoading(false)
      return
    }

    setDone(true)
    // profile ачаалагдахыг түр хүлээгээд, role-оор нь зөв хуудас руу шилжүүлнэ
    setTimeout(() => {
      navigate(isAdmin ? '/admin' : '/schedule')
    }, 1800)
  }

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '20px auto' }} />
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
          }}>
            <CheckCircle2 size={36} style={{ color: '#10b981' }} />
          </div>
          <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>Нууц үг тохируулагдлаа!</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Таны хуваарь руу шилжиж байна...</p>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <KeyRound size={40} style={{ opacity: 0.5, color: '#f97316', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Линк хүчингүй эсвэл дууссан байна</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginBottom: 20 }}>
            И-мэйлдээ ирсэн линкийг дахин дарна уу,<br />эсвэл шинээр нууц үг сэргээх хүсэлт илгээнэ үү.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary full">
            Нэвтрэх хуудас руу очих
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Award size={36} />
          <span>VolleyMN</span>
        </div>
        <h1>Нууц үг тохируулах</h1>
        <p className="auth-sub">Шинэ нууц үгээ оруулна уу.</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Шинэ нууц үг</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: 40 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center'
                }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Нууц үг давтах</label>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary full" disabled={loading}>
            {loading ? 'Хадгалж байна...' : 'Нууц үг хадгалах'}
          </button>
        </form>
      </div>
    </div>
  )
}
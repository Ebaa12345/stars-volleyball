import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Award, LogIn, Stars } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(form.email, form.password)
    if (error) {
      setError('И-мэйл эсвэл нууц үг буруу байна.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  async function handleForgotPassword() {
    if (!form.email.trim()) {
      setError('Эхлээд и-мэйл хаягаа оруулна уу.')
      return
    }
    setResetLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/set-password`,
    })
    setResetLoading(false)
    if (error) {
      setError('Линк илгээхэд алдаа гарлаа. Дахин оролдоно уу.')
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Stars size={36} />
          <span>Stars Volleyball</span>
        </div>
        <h1>Нэвтрэх</h1>
        

        {error && <div className="error-msg">{error}</div>}
        {resetSent && (
          <div style={{
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#10b981', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 12
          }}>
            Нууц үг сэргээх линкийг {form.email} хаягт илгээлээ. И-мэйлээ шалгана уу.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>И-мэйл</label>
            <input
              type="email"
              placeholder="email@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Нууц үг</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              style={{
                background: 'none', border: 'none', color: '#9ca3af',
                fontSize: '0.8rem', cursor: 'pointer', padding: 0, textDecoration: 'underline'
              }}
            >
              {resetLoading ? 'Илгээж байна...' : 'Нууц үг мартсан уу?'}
            </button>
          </div>
          <button type="submit" className="btn-primary full" disabled={loading}>
            {loading ? 'Нэвтэрж байна...' : <><LogIn size={16} /> Нэвтрэх</>}
          </button>
        </form>

        
      </div>
    </div>
  )
}
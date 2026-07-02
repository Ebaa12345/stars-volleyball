import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Award, UserPlus } from 'lucide-react'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    const { error } = await signUp(form.email, form.password, form.name)
    if (error) {
      setError(error.message || 'Бүртгэл үүсгэхэд алдаа гарлаа.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Award size={36} />
          <span>VolleyMN</span>
        </div>
        <h1>Бүртгүүлэх</h1>
        <p className="auth-sub">Клубт нэгдэж эхлэцгээе</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Бүтэн нэр</label>
            <input
              type="text"
              placeholder="Баатар Дорж"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
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
          <div className="form-group">
            <label>Нууц үг давтах</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary full" disabled={loading}>
            {loading ? 'Бүртгэж байна...' : <><UserPlus size={16} /> Бүртгүүлэх</>}
          </button>
        </form>

        <p className="auth-footer">
          Бүртгэлтэй юу?{' '}
          <Link to="/login">Нэвтрэх</Link>
        </p>
      </div>
    </div>
  )
}

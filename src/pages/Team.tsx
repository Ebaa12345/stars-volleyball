import { useEffect, useState } from 'react'
import { supabase, Profile } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { User, Users, Plus, X } from 'lucide-react'

export default function Team() {
  // Гараар засдаг байсан STATIC_TEAM-г Supabase-с шууд татахаар сольсон.
  // Admin бол энэ хуудаснаас шууд ("+" товч) бүртгэлтэй хэрэглэгчээ
  // дасгалжуулагч болгож нэмэх/хасах боломжтой — Admin панель рүү орох
  // шаардлагагүй.
  const { isAdmin } = useAuth()
  const [team, setTeam] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // Дасгалжуулагч нэмэх inline panel
  const [showAddCoach, setShowAddCoach] = useState(false)
  const [addCoachUserId, setAddCoachUserId] = useState('')
  const [addCoachPosition, setAddCoachPosition] = useState('')
  const [savingCoach, setSavingCoach] = useState(false)
  const [removingCoachId, setRemovingCoachId] = useState<string | null>(null)

  useEffect(() => {
    async function loadTeam() {
      setLoading(true)
      const { data } = await supabase.from('profiles').select('*').order('full_name', { ascending: true })
      setTeam((data as Profile[]) || [])
      setLoading(false)
    }
    loadTeam()
  }, [])

  // Ангилал салгах логик
  const coaches = team.filter(m => m.role === 'coach')
  const players = team.filter(m => m.role !== 'coach')

  // ── Admin: бүртгэлтэй хэрэглэгчийг дасгалжуулагч болгож нэмэх ──
  async function addCoach() {
    if (!addCoachUserId) return
    setSavingCoach(true)
    const { error } = await supabase.from('profiles')
      .update({ role: 'coach', position: addCoachPosition || null })
      .eq('id', addCoachUserId)
    if (!error) {
      setTeam(prev => prev.map(m => m.id === addCoachUserId ? { ...m, role: 'coach', position: addCoachPosition || m.position } : m))
      setShowAddCoach(false)
      setAddCoachUserId('')
      setAddCoachPosition('')
    } else {
      alert('Алдаа: ' + error.message)
    }
    setSavingCoach(false)
  }

  // ── Admin: дасгалжуулагчийг жагсаалтаас хасаж, энгийн хэрэглэгч болгох ──
  async function removeCoach(id: string) {
    if (!window.confirm('Дасгалжуулагчийн жагсаалтаас хасах уу? (Бүртгэл устгагдахгүй, зөвхөн "user" эрх рүү шилжинэ.)')) return
    setRemovingCoachId(id)
    const { error } = await supabase.from('profiles').update({ role: 'user' }).eq('id', id)
    if (!error) {
      setTeam(prev => prev.map(m => m.id === id ? { ...m, role: 'user' } : m))
    } else {
      alert('Алдаа: ' + error.message)
    }
    setRemovingCoachId(null)
  }

  return (
    <div className="page team-page">
      <div className="team-glow" aria-hidden="true" />
      <div className="container">

        {/* Толгой хэсэг */}
        <div className="page-header text-left">
          <span className="eyebrow">БҮРЭЛДЭХҮҮН</span>
          <h1>Манай баг хамт олон</h1>
          <p>Нэг зорилго, нэгдмэл хүч чадал</p>
        </div>

        {loading ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : (
          <div className="team-page-layout-modern">

            {/* 1. ДАСГАЛЖУУЛАГЧИД ХЭСЭГ — admin бол хоосон байсан ч харагдана ("+" товчны төлөө) */}
            {(coaches.length > 0 || isAdmin) && (
              <div className="team-section-modern border-grid-box mt-32">
                <div className="team-section-header-modern">
                  <h2 className="section-title-modern">Дасгалжуулагчид</h2>
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddCoach(v => !v)}
                      className="filter-tab-btn-modern"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {showAddCoach ? <X size={14} /> : <Plus size={14} />}
                      {showAddCoach ? 'Хаах' : 'Дасгалжуулагч нэмэх'}
                    </button>
                  )}
                </div>

                {/* Нэмэх inline panel — бүртгэлтэй хэрэглэгчээс сонгоно */}
                {isAdmin && showAddCoach && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.5fr 1.3fr auto', gap: 10, alignItems: 'center',
                    background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: 14, marginBottom: 18,
                  }}>
                    <select
                      value={addCoachUserId}
                      onChange={e => setAddCoachUserId(e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '10px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }}
                    >
                      <option value="">— Бүртгэлтэй хэрэглэгч сонгох —</option>
                      {players.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Цол (ж: Ерөнхий Дасгалжуулагч)"
                      value={addCoachPosition}
                      onChange={e => setAddCoachPosition(e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '10px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }}
                    />
                    <button
                      onClick={addCoach}
                      disabled={!addCoachUserId || savingCoach}
                      style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: !addCoachUserId ? 'not-allowed' : 'pointer', opacity: !addCoachUserId ? 0.5 : 1, whiteSpace: 'nowrap' }}
                    >
                      {savingCoach ? '...' : 'Нэмэх'}
                    </button>
                    {players.length === 0 && (
                      <p style={{ gridColumn: '1 / -1', margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>
                        Дасгалжуулагч болгох боломжтой бүртгэлтэй хэрэглэгч алга байна.
                      </p>
                    )}
                  </div>
                )}

                {coaches.length === 0 ? (
                  <p className="empty-team-message">
                    Одоогоор дасгалжуулагч бүртгэгдээгүй байна. Дээрх "Дасгалжуулагч нэмэх" товчоор нэмнэ үү.
                  </p>
                ) : (
                  <div className="team-grid-horizontal coaches-row">
                    {coaches.map(coach => (
                      <div key={coach.id} className="member-card-horizontal coach">
                        <div className="avatar-side-box coach-avatar-bg">
                          <div className="avatar-circle-wrapper">
                            {coach.avatar_url ? (
                              <img src={coach.avatar_url} alt={coach.full_name} className="img-fit" />
                            ) : (
                              <User size={32} className="user-placeholder-icon" />
                            )}
                          </div>
                        </div>

                        <div className="info-side-box">
                          <div className="top-corner-icon-box">
                            {isAdmin ? (
                              <button
                                onClick={() => removeCoach(coach.id)}
                                disabled={removingCoachId === coach.id}
                                title="Дасгалжуулагчаас хасах"
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                              >
                                <X size={16} />
                              </button>
                            ) : (
                              <Users size={16} />
                            )}
                          </div>
                          <span className="position-label-text coach-label-accent">{coach.position || 'Дасгалжуулагч'}</span>
                          <h3 className="member-name-text mt-4">{coach.full_name}</h3>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
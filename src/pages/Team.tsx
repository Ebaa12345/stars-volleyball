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
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // Admin-ий "дасгалжуулагч болгох" dropdown-д зориулсан, дасгалжуулагч БОЛОН
  // admin-аас бусад бүртгэлтэй хэрэглэгчдийн жагсаалт — зөвхөн admin үзнэ
  // (доор isAdmin true үед л татна).
  const [candidates, setCandidates] = useState<Profile[]>([])

  // Дасгалжуулагч нэмэх inline panel
  const [showAddCoach, setShowAddCoach] = useState(false)
  const [addCoachUserId, setAddCoachUserId] = useState('')
  const [addCoachPosition, setAddCoachPosition] = useState('')
  const [savingCoach, setSavingCoach] = useState(false)
  const [removingCoachId, setRemovingCoachId] = useState<string | null>(null)

  useEffect(() => {
    async function loadCoaches() {
      setLoading(true)
      // Нийтэд (нэвтрээгүй зочид ч) харагддаг тул profiles-ыг шууд уншихгүй
      // (email leak-ээс сэргийлж RLS-ээр хаагдсан) — зөвхөн аюулгүй
      // талбаруудыг буцаадаг RPC ашиглана.
      const { data } = await supabase.rpc('get_public_team_members')
      setCoaches((data as Profile[]) || [])
      setLoading(false)
    }
    loadCoaches()
  }, [])

  // Admin-only: дасгалжуулагч болгох боломжтой хэрэглэгчид (зөвхөн 'user' —
  // 'admin' эрхтэй хүнийг санамсаргүй coach болгож бууруулахаас сэргийлнэ).
  useEffect(() => {
    if (!isAdmin) { setCandidates([]); return }
    supabase.from('profiles').select('*').eq('role', 'user').order('full_name', { ascending: true })
      .then(({ data }) => setCandidates((data as Profile[]) || []))
  }, [isAdmin])

  // ── Admin: бүртгэлтэй хэрэглэгчийг дасгалжуулагч болгож нэмэх ──
  async function addCoach() {
    if (!addCoachUserId) return
    setSavingCoach(true)
    const { error } = await supabase.from('profiles')
      .update({ role: 'coach', position: addCoachPosition || null })
      .eq('id', addCoachUserId)
    if (!error) {
      const promoted = candidates.find(c => c.id === addCoachUserId)
      if (promoted) setCoaches(prev => [...prev, { ...promoted, role: 'coach', position: addCoachPosition || promoted.position }])
      setCandidates(prev => prev.filter(c => c.id !== addCoachUserId))
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
      const demoted = coaches.find(c => c.id === id)
      setCoaches(prev => prev.filter(c => c.id !== id))
      if (demoted) setCandidates(prev => [...prev, { ...demoted, role: 'user' }])
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
                      {candidates.map(p => (
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
                    {candidates.length === 0 && (
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
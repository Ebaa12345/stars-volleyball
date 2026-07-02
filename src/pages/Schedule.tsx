import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, SessionAssignment, SessionType } from '../lib/supabase'
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Gauge, CheckCircle2, XCircle, History } from 'lucide-react'

const DAY_NAMES_SHORT = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня']
const DAY_NAMES_FULL = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням']
const MONTH_NAMES = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар']

const TYPE_CONFIG: Record<SessionType, { label: string; color: string; bg: string }> = {
  practice: { label: 'Дасгал', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' },
  match: { label: 'Тоглолт', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)' },
  training: { label: 'Биеийн тамир', color: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },
  rest: { label: 'Амралт', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.05)' },
}

function ymd(d: Date) { return d.toISOString().split('T')[0] }

function displayDate(dateStr: string) {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}/${d}`
}

function dowFullLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DAY_NAMES_FULL[(new Date(y, m - 1, d).getDay() + 6) % 7]
}

function buildCalendarCells(month: Date) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstOfM = new Date(year, m, 1)
  const startWD = (firstOfM.getDay() + 6) % 7
  const daysInM = new Date(year, m + 1, 0).getDate()
  const prevLast = new Date(year, m, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = startWD - 1; i >= 0; i--) cells.push({ date: new Date(year, m - 1, prevLast - i), inMonth: false })
  for (let d = 1; d <= daysInM; d++) cells.push({ date: new Date(year, m, d), inMonth: true })
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date
    const next = new Date(last); next.setDate(last.getDate() + 1)
    cells.push({ date: next, inMonth: false })
    if (cells.length >= 42) break
  }
  return cells
}

export default function Schedule() {
  const { user } = useAuth()
  const [viewMonth, setViewMonth] = useState(new Date())
  const [assignments, setAssignments] = useState<SessionAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [userLimit, setUserLimit] = useState(15) // Default 15 удаа/сар
  const [attMonthMap, setAttMonthMap] = useState<Record<string, 'present' | 'absent'>>({})

  useEffect(() => {
    async function loadMonth() {
      if (!user) return
      setLoading(true)

      // 1. Хэрэглэгчийн сарын лимит (удаа)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('monthly_visit_limit')
        .eq('id', user.id)
        .single()

      if (profileData?.monthly_visit_limit) setUserLimit(profileData.monthly_visit_limit)

      // 2. Тухайн сарын хугацаа
      const year = viewMonth.getFullYear()
      const m = viewMonth.getMonth()
      const first = ymd(new Date(year, m, 1))
      const last = ymd(new Date(year, m + 1, 0))

      // 3. Тухайн сард админаас оноогдсон хуваарь (аль ч өдөр байж болно)
      const { data: assignData } = await supabase
        .from('session_assignments')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: true })

      setAssignments((assignData as SessionAssignment[]) || [])

      // 4. Тухайн сарын ирц (зөвхөн "Ирсэн" гэж тэмдэглэсэн өдөр сарын лимит рүү тооцогдоно)
      const { data: attData } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('user_id', user.id)
        .gte('date', first)
        .lte('date', last)

      const attMap: Record<string, 'present' | 'absent'> = {}
      if (attData) attData.forEach(row => { attMap[row.date] = row.status as 'present' | 'absent' })
      setAttMonthMap(attMap)

      setLoading(false)
    }

    loadMonth()
  }, [user, viewMonth])

  const monthLabel = `${MONTH_NAMES[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`
  const attCells = buildCalendarCells(viewMonth)
  const todayDateStr = ymd(new Date())

  const presentCount = Object.values(attMonthMap).filter(s => s === 'present').length
  const absentCount = Object.values(attMonthMap).filter(s => s === 'absent').length

  // Сарын лимитийн явц: зөвхөн "Ирсэн" гэж тэмдэглэсэн өдрүүд л тооцогдоно
  const percentage = Math.min(Math.round((presentCount / userLimit) * 100), 100)

  let statusColor = '#3b82f6'
  let motivationalText = 'Бэлтгэлээ эрч хүчтэй эхлүүлье! 🔥'
  if (percentage >= 50) { statusColor = '#f59e0b'; motivationalText = 'Сайн байна, тал хувьдаа хүрлээ! ⚡' }
  if (percentage >= 80) { statusColor = '#10b981'; motivationalText = 'Гайхалтай! Зорьсондоо хүрэхэд ойрхон байна 🏆' }

  // Хуваарийг огноогоор нь бүлэглэх (аль ч өдөр байж болно, долоо хоногийн тогтмол загвар биш)
  const assignmentsByDate: Record<string, SessionAssignment[]> = {}
  assignments.forEach(a => { (assignmentsByDate[a.date] ||= []).push(a) })
  const sortedDates = Object.keys(assignmentsByDate).sort()

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '1000px' }}>

        {/* ТОЛГОЙ ХЭСЭГ */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="eyebrow">Миний хянах самбар</span>
            <h1>Хувийн бэлтгэлийн хуваарь</h1>
          </div>

          {/* Сар солих навигаци */}
          <div className="week-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} /></button>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', minWidth: '110px', textAlign: 'center' }}>{monthLabel}</span>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* ЯВЦЫН ПРОГРЕСС КАРТ */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20, 27, 47, 0.8) 0%, rgba(10, 15, 30, 0.9) 100%)',
          border: `1px solid ${statusColor}33`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 0 20px ${statusColor}10`,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: statusColor, filter: 'blur(70px)', opacity: 0.15, pointerEvents: 'none' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: `${statusColor}15`, color: statusColor, padding: '10px', borderRadius: '12px', border: `1px solid ${statusColor}33` }}>
                <Gauge size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Сарын лимитийн биелэлт</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>{motivationalText}</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: statusColor, letterSpacing: '-0.5px' }}>{percentage}%</span>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>Явцын хувь</div>
            </div>
          </div>

          <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ width: `${percentage}%`, height: '100%', background: `linear-gradient(90deg, ${statusColor}cc, ${statusColor})`, boxShadow: `0 0 12px ${statusColor}`, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
          </div>

          <div style={{ display: 'flex', gap: '24px', fontSize: '0.88rem', color: '#e5e7eb', background: 'rgba(0,0,0,0.2)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
            <div>Ирсэн: <strong style={{ color: statusColor, fontSize: '0.95rem' }}>{presentCount} удаа</strong></div>
            <div style={{ color: 'rgba(255,255,255,0.15)' }}>|</div>
            <div>Сарын лимит: <strong style={{ color: '#fff' }}>{userLimit} удаа</strong></div>
            <div style={{ color: 'rgba(255,255,255,0.15)' }}>|</div>
            <div>Дутуу: <strong style={{ color: '#9ca3af' }}>{Math.max(0, userLimit - presentCount)} удаа</strong></div>
          </div>
        </div>

        {/* ИРЦИЙН САРЫН CALENDAR */}
        <div style={{ background: 'rgba(20,27,47,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 20px', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={16} style={{ color: '#3b82f6' }} />
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>Миний ирцийн бүртгэл</h3>
            </div>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>{monthLabel}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
            {DAY_NAMES_SHORT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {attCells.map((cell, idx) => {
              const dateStr = ymd(cell.date)
              const status = attMonthMap[dateStr]
              const isToday = dateStr === todayDateStr
              const isFuture = cell.date > new Date()
              return (
                <div key={idx} style={{
                  aspectRatio: '1', minHeight: 44,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  borderRadius: 8,
                  background: status === 'present' ? 'rgba(16,185,129,0.12)' : status === 'absent' ? 'rgba(239,68,68,0.08)' : isToday ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.15)',
                  border: isToday ? '1px solid rgba(59,130,246,0.3)' : status === 'present' ? '1px solid rgba(16,185,129,0.3)' : status === 'absent' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.03)',
                  opacity: cell.inMonth ? 1 : 0.2,
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#60a5fa' : cell.inMonth ? '#e5e7eb' : '#374151' }}>
                    {cell.date.getDate()}
                  </span>
                  {cell.inMonth && !isFuture && (
                    status === 'present' ? <CheckCircle2 size={13} style={{ color: '#10b981' }} /> :
                    status === 'absent' ? <XCircle size={13} style={{ color: '#ef4444' }} /> :
                    <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.15)' }} />
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Ирсэн: {presentCount}</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>✗ Ирээгүй: {absentCount}</span>
          </div>
        </div>

        {/* ХУВААРИЙН ЖАГСААЛТ — сарын аль ч өдөрт оноогдсон бэлтгэлүүд */}
        {loading ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>Уншиж байна...</p>
        ) : sortedDates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(20, 27, 47, 0.2)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <Calendar size={32} style={{ color: '#6b7280', marginBottom: '12px' }} />
            <h3 style={{ color: '#fff', margin: '0 0 4px 0', fontSize: '1rem' }}>Энэ сард хуваарь оноогдоогүй байна</h3>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: 0 }}>Админ таны бэлтгэлийн өдөр, цагийг оруулахад энд харагдах болно.</p>
          </div>
        ) : (
          <div className="schedule-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedDates.map(dateStr => {
              const daySlots = assignmentsByDate[dateStr]
              return (
                <div key={dateStr} style={{ background: 'rgba(20, 27, 47, 0.45)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '18px' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '14px', background: '#3b82f6', borderRadius: '4px' }}></span>
                    {displayDate(dateStr)} · {dowFullLabel(dateStr)}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                    {daySlots.map(slot => {
                      const cfg = TYPE_CONFIG[slot.type] || TYPE_CONFIG.practice
                      return (
                        <div key={slot.id} style={{ borderLeft: `4px solid ${cfg.color}`, background: cfg.bg, padding: '14px', borderRadius: '4px 10px 10px 4px', borderTop: '1px solid rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ color: cfg.color, fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cfg.label}</span>
                          </div>
                          {slot.type !== 'rest' && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.88rem', marginBottom: '6px', fontWeight: 500 }}>
                                <Clock size={13} style={{ color: '#9ca3af' }} /> {slot.start_time} – {slot.end_time}
                              </div>
                              {slot.location && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '0.82rem', marginBottom: '8px' }}>
                                  <MapPin size={13} /> {slot.location}
                                </div>
                              )}
                            </>
                          )}
                          {slot.notes && <p style={{ margin: 0, padding: '6px 8px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', fontSize: '0.8rem', color: '#d1d5db', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>{slot.notes}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
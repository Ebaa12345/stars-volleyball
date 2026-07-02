import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  ChevronLeft, ChevronRight, Download, FileText,
  CheckCircle2, XCircle, User, TrendingUp, Calendar
} from 'lucide-react'

interface AttendanceRow {
  user_id: string
  date: string
  status: 'present' | 'absent'
}

interface ProfileRow {
  id: string
  full_name: string
  email: string
  role: string
  monthly_visit_limit?: number
}

const MONTH_NAMES = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
  '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар']
const DAY_NAMES = ['Да','Мя','Лх','Пү','Ба','Бя','Ня']

function buildMonthDates(year: number, month: number): string[] {
  const days = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: days }, (_, i) =>
    `${year}-${String(month + 1).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`
  )
}

function dayOfWeekLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DAY_NAMES[(new Date(y, m - 1, d).getDay() + 6) % 7]
}

export default function Report() {
  const { isAdmin, user } = useAuth()
  const [reportMonth, setReportMonth] = useState(new Date())
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | 'all'>('all')

  const year = reportMonth.getFullYear()
  const monthIdx = reportMonth.getMonth()
  const monthDates = buildMonthDates(year, monthIdx)
  const today = new Date().toISOString().split('T')[0]
  const pastDates = monthDates.filter(d => d <= today)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const first = monthDates[0]
      const last = monthDates[monthDates.length - 1]

      if (isAdmin) {
        const [{ data: attData }, { data: profData }] = await Promise.all([
          supabase.from('attendance').select('user_id, date, status').gte('date', first).lte('date', last),
          supabase.from('profiles').select('id, full_name, email, role, monthly_visit_limit').order('full_name')
        ])
        setAttendance((attData as AttendanceRow[]) || [])
        setProfiles((profData as ProfileRow[]) || [])
      } else if (user) {
        const [{ data: attData }, { data: myProfile }] = await Promise.all([
          supabase.from('attendance').select('user_id, date, status').eq('user_id', user.id).gte('date', first).lte('date', last),
          supabase.from('profiles').select('id, full_name, email, role, monthly_visit_limit').eq('id', user.id).single()
        ])
        setAttendance((attData as AttendanceRow[]) || [])
        // Админ бус хэрэглэгчийн хувьд ч гэсэн өөрийн мөрийг profiles-д тавьж өгнө —
        // үгүй бол доорх жагсаалт хоосон гарч, тайлан огт харагдахгүй байсан алдаа байсан.
        setProfiles(myProfile ? [myProfile as ProfileRow] : [{ id: user.id, full_name: 'Би', email: user.email || '', role: 'user', monthly_visit_limit: 15 }])
      }
      setLoading(false)
    }
    load()
  }, [reportMonth, isAdmin, user])

  // ── Build lookup: userId → date → status ──
  const lookup: Record<string, Record<string, 'present' | 'absent'>> = {}
  attendance.forEach(row => {
    if (!lookup[row.user_id]) lookup[row.user_id] = {}
    lookup[row.user_id][row.date] = row.status
  })

  const displayProfiles = isAdmin
    ? (selectedUser === 'all' ? profiles : profiles.filter(p => p.id === selectedUser))
    : profiles

  // ── Stats per user: "Лимитийн явц %" = энэ сарын Ирсэн тоо / сарын лимит (удаа) ──
  // (Хуучин хувилбарт энэ хувь нь "Ирсэн / өнгөрсөн өдрүүд" гэж тооцогддог байсан бөгөөд
  // энэ нь Schedule/Admin дээрх сарын лимитийн тооцооноос өөр байсан — эндээс зөрчил гардаг байлаа.)
  function userStats(userId: string, limit: number) {
    const map = lookup[userId] || {}
    const present = pastDates.filter(d => map[d] === 'present').length
    const absent = pastDates.filter(d => map[d] === 'absent').length
    const unmarked = pastDates.length - present - absent
    const pct = limit > 0 ? Math.min(100, Math.round((present / limit) * 100)) : 0
    return { present, absent, unmarked, pct }
  }

  // ── CSV Export ──
  function exportCSV() {
    const rows: string[][] = []
    const header = ['Нэр', 'И-мэйл', 'Сарын лимит', ...pastDates.map(d => `${d}(${dayOfWeekLabel(d)})`), 'Ирсэн', 'Ирээгүй', 'Лимитийн явц%']
    rows.push(header)

    const exportProfiles = isAdmin ? profiles : profiles
    exportProfiles.forEach(p => {
      const map = lookup[p.id] || {}
      const limit = p.monthly_visit_limit || 15
      const cells = pastDates.map(d => map[d] === 'present' ? '✓' : map[d] === 'absent' ? '✗' : '-')
      const { present, absent, pct } = userStats(p.id, limit)
      rows.push([p.full_name, p.email, String(limit), ...cells, String(present), String(absent), `${pct}%`])
    })

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ирц_тайлан_${year}_${monthIdx + 1}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const C = { present: '#10b981', absent: '#ef4444', unmarked: '#374151' }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 1200 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <span className="eyebrow">Тайлан</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, margin: 0 }}>Ирцийн тайлан</h1>
            <p style={{ color: '#9ca3af', marginTop: 4 }}>
              {MONTH_NAMES[monthIdx]} {year} — нийт {pastDates.length} өдөр бүртгэгдсэн. Хувь нь сарын лимит (удаа) дээр суурилна.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.3)', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setReportMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
              <span style={{ fontWeight: 700, color: '#fff', minWidth: 120, textAlign: 'center' }}>{MONTH_NAMES[monthIdx]} {year}</span>
              <button onClick={() => setReportMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><ChevronRight size={18} /></button>
            </div>
            <button onClick={exportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
              <Download size={16} /> CSV татах
            </button>
          </div>
        </div>

        {/* Admin: user filter */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedUser('all')}
              style={{ padding: '7px 16px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', background: selectedUser === 'all' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedUser === 'all' ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, color: selectedUser === 'all' ? '#60a5fa' : '#9ca3af' }}>
              Бүгд
            </button>
            {profiles.map(p => (
              <button key={p.id} onClick={() => setSelectedUser(p.id)}
                style={{ padding: '7px 16px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', background: selectedUser === p.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selectedUser === p.id ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, color: selectedUser === p.id ? '#60a5fa' : '#9ca3af' }}>
                {p.full_name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : (
          <>
            {/* Summary cards */}
            {isAdmin && selectedUser === 'all' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
                {profiles.map(p => {
                  const limit = p.monthly_visit_limit || 15
                  const { present, absent, pct } = userStats(p.id, limit)
                  const sc = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={p.id}
                      onClick={() => setSelectedUser(p.id)}
                      style={{ background: 'rgba(20,27,47,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${sc}18`, border: `2px solid ${sc}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={16} style={{ color: sc }} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.full_name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{p.role === 'admin' ? '⚡ admin' : '👤 user'}</div>
                        </div>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#9ca3af', marginBottom: 4 }}>
                          <span>Лимитийн явц</span>
                          <span style={{ color: sc, fontWeight: 800 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: sc, transition: 'width .4s' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem' }}>
                        <span style={{ color: '#10b981' }}>✓ {present}/{limit}</span>
                        <span style={{ color: '#ef4444' }}>✗ {absent}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* Detail table per user */}
            {displayProfiles.map(p => {
              const map = lookup[p.id] || {}
              const limit = p.monthly_visit_limit || 15
              const { present, absent, unmarked, pct } = userStats(p.id, limit)
              const sc = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

              return (
                <div key={p.id} style={{ background: 'rgba(20,27,47,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 22px', marginBottom: 20 }}>
                  {/* User header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${sc}15`, border: `2px solid ${sc}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={18} style={{ color: sc }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>{p.full_name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{p.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-display)' }}>{present}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Ирсэн</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-display)' }}>{absent}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Ирээгүй</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#9ca3af', fontFamily: 'var(--font-display)' }}>{unmarked}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Тэмдэглээгүй</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e5e7eb', fontFamily: 'var(--font-display)' }}>{limit}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Сарын лимит</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 60 }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: sc, fontFamily: 'var(--font-display)' }}>{pct}%</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Лимитийн явц</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: sc, transition: 'width .5s' }} />
                  </div>

                  {/* Calendar heatmap */}
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                      {DAY_NAMES.map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#6b7280' }}>{d}</div>
                      ))}
                    </div>
                    {(() => {
                      // Build full calendar cells for month
                      const firstD = new Date(year, monthIdx, 1)
                      const startWD = (firstD.getDay() + 6) % 7
                      const cells: { dateStr: string | null }[] = []
                      for (let i = 0; i < startWD; i++) cells.push({ dateStr: null })
                      monthDates.forEach(d => cells.push({ dateStr: d }))
                      while (cells.length % 7 !== 0) cells.push({ dateStr: null })
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                          {cells.map((cell, idx) => {
                            if (!cell.dateStr) return <div key={idx} />
                            const s = map[cell.dateStr]
                            const isFuture = cell.dateStr > today
                            const isToday = cell.dateStr === today
                            const dayNum = parseInt(cell.dateStr.split('-')[2])
                            return (
                              <div key={idx} title={`${cell.dateStr} — ${s === 'present' ? 'Ирсэн' : s === 'absent' ? 'Ирээгүй' : 'Тэмдэглээгүй'}`}
                                style={{
                                  aspectRatio: '1', borderRadius: 6, minHeight: 36,
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                                  background: isFuture ? 'rgba(0,0,0,0.1)' : s === 'present' ? 'rgba(16,185,129,0.18)' : s === 'absent' ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.03)',
                                  border: isToday ? '1.5px solid rgba(59,130,246,0.5)' : s === 'present' ? '1px solid rgba(16,185,129,0.35)' : s === 'absent' ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(255,255,255,0.04)',
                                }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: isFuture ? '#374151' : s === 'present' ? '#6ee7b7' : s === 'absent' ? '#fca5a5' : '#4b5563' }}>{dayNum}</span>
                                {!isFuture && (
                                  s === 'present' ? <CheckCircle2 size={11} style={{ color: '#10b981' }} /> :
                                  s === 'absent' ? <XCircle size={11} style={{ color: '#ef4444' }} /> :
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1px dashed #374151' }} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Attended dates list */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 8, fontWeight: 700 }}>Ирсэн өдрүүд:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pastDates.filter(d => map[d] === 'present').length === 0 ? (
                        <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>Бүртгэл байхгүй</span>
                      ) : pastDates.filter(d => map[d] === 'present').map(d => (
                        <span key={d} style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                          {parseInt(d.split('-')[2])}/{parseInt(d.split('-')[1])} {dayOfWeekLabel(d)}
                        </span>
                      ))}
                    </div>
                    {pastDates.filter(d => map[d] === 'absent').length > 0 && (
                      <>
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 8, marginTop: 10, fontWeight: 700 }}>Ирээгүй өдрүүд:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {pastDates.filter(d => map[d] === 'absent').map(d => (
                            <span key={d} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                              {parseInt(d.split('-')[2])}/{parseInt(d.split('-')[1])} {dayOfWeekLabel(d)}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
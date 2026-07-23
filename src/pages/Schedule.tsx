import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase, SessionAssignment, SessionType } from '../lib/supabase'
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, ChevronDown, Gauge, CheckCircle2, XCircle, History, ListChecks } from 'lucide-react'

const DAY_NAMES_SHORT = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня']
const DAY_NAMES_FULL = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням']
const MONTH_NAMES = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар']

const TYPE_CONFIG: Record<SessionType, { label: string; color: string }> = {
  practice: { label: 'Дасгал', color: '#3b82f6' },
  match: { label: 'Тоглолт', color: '#ef4444' },
  training: { label: 'Биеийн тамир', color: '#10b981' },
  rest: { label: 'Амралт', color: '#6b7280' },
}

// Hex өнгийг "r, g, b" мөр болгож хөрвүүлнэ — CSS дотор rgba(var(--accent-rgb), alpha)
// хэлбэрээр ашиглана (Home.tsx-ийн stat-card-тай нэг загвар).
function hexToRgbTriplet(hex: string) {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`
}

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  // program_id -> нэр. Тухайн бэлтгэл ямар хөтөлбөрт хамаарахыг (жишээ нь
  // "1-р хөтөлбөр") тоглогчид өөрсдөд нь харуулахын тулд.
  const [programNames, setProgramNames] = useState<Record<string, string>>({})
  // Хуваарийг өдөр бүрээр хумиад/дэлгэдэг (accordion) болгосон — аль өдрүүд
  // одоо дэлгэрэнгүй харагдаж байгааг заана.
  const [openDates, setOpenDates] = useState<Set<string>>(new Set())
  // Ирцийн сарын мини-календарь ч мөн хумигдаж/дэлгэгддэг — эхэндээ хумигдсан.
  const [attCalendarOpen, setAttCalendarOpen] = useState(false)

  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase.from('programs').select('id, name')
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((p: any) => { map[p.id] = p.name })
        setProgramNames(map)
      }
    }
    loadPrograms()
  }, [])

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

  // Сар солиход өмнөх сарын нээлттэй/хаалттай төлөв шинэ сард хамаарахгүй
  // тул цэвэрлээд, доорх effect-д дахин "анхны төлөв" тооцуулна.
  useEffect(() => { setOpenDates(new Set()) }, [viewMonth])

  // Хуваарь ачаалагдмагц өдрүүд ирэхэд: өнөөдрийг (эсвэл хамгийн ойрын
  // ирээдүйн огноог) анхнаасаа дэлгэрэнгүй нээлттэй харуулна, бусад нь
  // хумигдсан хэвээр — хэрэглэгч аль хэдийн өөрөө нээж/хаасан бол хөндөхгүй.
  useEffect(() => {
    if (sortedDates.length === 0) return
    setOpenDates(prev => {
      if (prev.size > 0) return prev
      const defaultOpen = sortedDates.includes(todayDateStr)
        ? todayDateStr
        : (sortedDates.find(d => d >= todayDateStr) || sortedDates[0])
      return new Set([defaultOpen])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedDates.join(',')])

  function toggleDate(date: string) {
    setOpenDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  // Энэ сард ХАМРАГДАЖ буй хөтөлбөрүүд (нэг товч мэдээлэл болгож дээр нь харуулах)
  const myProgramIds = Array.from(new Set(assignments.map(a => a.program_id).filter(Boolean))) as string[]
  const myProgramNames = myProgramIds.map(id => programNames[id]).filter(Boolean)

  return (
    <div className="page schedule-page">
      <div className="schedule-glow" aria-hidden="true" />
      <div className="container" style={{ maxWidth: '1000px', position: 'relative', zIndex: 1 }}>

        {/* ТОЛГОЙ ХЭСЭГ */}
        <div className="schedule-header">
          <div>
            <span className="eyebrow">Миний хянах самбар</span>
            <h1>Хувийн бэлтгэлийн хуваарь</h1>
          </div>

          <div className="schedule-month-nav">
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Өмнөх сар"><ChevronLeft size={18} /></button>
            <span>{monthLabel}</span>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Дараагийн сар"><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* ХАМРАГДАЖ БУЙ ХӨТӨЛБӨРҮҮД — энэ сард ямар хөтөлбөрт (нэрээр) хамрагдаж байгааг харуулна */}
        {myProgramNames.length > 0 && (
          <div className="schedule-programs-row">
            <span className="schedule-programs-label"><ListChecks size={15} /> Миний хөтөлбөр:</span>
            <div className="schedule-programs-chips">
              {myProgramNames.map(name => (
                <span key={name} className="schedule-program-chip">{name}</span>
              ))}
            </div>
          </div>
        )}

        {/* ЯВЦЫН ПРОГРЕСС КАРТ */}
        <div
          className="schedule-progress-card"
          style={{ ['--accent' as any]: statusColor, ['--accent-rgb' as any]: hexToRgbTriplet(statusColor) }}
        >
          <div className="schedule-progress-glow" aria-hidden="true" />

          <div className="schedule-progress-head">
            <div className="schedule-progress-title">
              <div className="schedule-progress-icon"><Gauge size={22} /></div>
              <div>
                <h3>Сарын лимитийн биелэлт</h3>
                <p>{motivationalText}</p>
              </div>
            </div>
            <div className="schedule-progress-percent">
              <span>{percentage}%</span>
              <div>Явцын хувь</div>
            </div>
          </div>

          <div className="schedule-progress-bar">
            <div className="schedule-progress-bar-fill" style={{ width: `${percentage}%` }} />
          </div>

          <div className="schedule-progress-stats">
            <div>Ирсэн: <strong>{presentCount} удаа</strong></div>
            <div className="schedule-progress-divider" />
            <div>Сарын лимит: <strong>{userLimit} удаа</strong></div>
            <div className="schedule-progress-divider" />
            <div>Дутуу: <strong>{Math.max(0, userLimit - presentCount)} удаа</strong></div>
          </div>
        </div>

        {/* ИРЦИЙН САРЫН CALENDAR — хумиад/дэлгэдэг */}
        <div className={`schedule-att-card${attCalendarOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="schedule-att-head"
            onClick={() => setAttCalendarOpen(v => !v)}
            aria-expanded={attCalendarOpen}
          >
            <h3><History size={16} /> Миний ирцийн бүртгэл</h3>
            <span className="schedule-att-head-right">
              {monthLabel}
              <ChevronDown size={16} className="schedule-att-chevron" />
            </span>
          </button>

          <div className="schedule-att-body">
            <div className="schedule-att-body-inner">
              <div className="schedule-att-grid schedule-att-dow">
                {DAY_NAMES_SHORT.map(d => <div key={d}>{d}</div>)}
              </div>

              <div className="schedule-att-grid">
                {attCells.map((cell, idx) => {
                  const dateStr = ymd(cell.date)
                  const status = attMonthMap[dateStr]
                  const isToday = dateStr === todayDateStr
                  const isFuture = cell.date > new Date()
                  const stateClass = status === 'present' ? 'present' : status === 'absent' ? 'absent' : isToday ? 'today' : ''
                  return (
                    <div
                      key={idx}
                      className={`schedule-att-cell${stateClass ? ` ${stateClass}` : ''}${!cell.inMonth ? ' out-of-month' : ''}`}
                    >
                      <span>{cell.date.getDate()}</span>
                      {cell.inMonth && !isFuture && (
                        status === 'present' ? <CheckCircle2 size={13} /> :
                        status === 'absent' ? <XCircle size={13} /> :
                        <span className="schedule-att-dot" />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="schedule-att-legend">
                <span className="present">✓ Ирсэн: {presentCount}</span>
                <span className="absent">✗ Ирээгүй: {absentCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ХУВААРИЙН ЖАГСААЛТ — сарын аль ч өдөрт оноогдсон бэлтгэлүүд */}
        {loading ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : sortedDates.length === 0 ? (
          <div className="schedule-empty">
            <Calendar size={32} />
            <h3>Энэ сард хуваарь оноогдоогүй байна</h3>
            <p>Админ таны бэлтгэлийн өдөр, цагийг оруулахад энд харагдах болно.</p>
          </div>
        ) : (
          <div className="schedule-day-list">
            {sortedDates.map((dateStr, dateIdx) => {
              const daySlots = assignmentsByDate[dateStr]
              const isOpen = openDates.has(dateStr)
              return (
                <div
                  key={dateStr}
                  className={`schedule-day-group${isOpen ? ' open' : ''}`}
                  style={{ animationDelay: `${dateIdx * 60}ms` }}
                >
                  <button
                    type="button"
                    className="schedule-day-title"
                    onClick={() => toggleDate(dateStr)}
                    aria-expanded={isOpen}
                  >
                    <span className="schedule-day-bar" />
                    <span className="schedule-day-label">{displayDate(dateStr)} · {dowFullLabel(dateStr)}</span>
                    <span className="schedule-day-count">{daySlots.length}</span>
                    <ChevronDown size={16} className="schedule-day-chevron" />
                  </button>
                  <div className="schedule-day-body">
                    <div className="schedule-day-body-inner">
                      <div className="schedule-session-grid">
                        {daySlots.map(slot => {
                          const cfg = TYPE_CONFIG[slot.type] || TYPE_CONFIG.practice
                          const programName = slot.program_id ? programNames[slot.program_id] : undefined
                          return (
                            <div key={slot.id} className="schedule-session-card" style={{ ['--accent' as any]: cfg.color, ['--accent-rgb' as any]: hexToRgbTriplet(cfg.color) }}>
                              <div className="schedule-session-head">
                                <span className="schedule-session-type">{cfg.label}</span>
                                {programName && <span className="schedule-session-program">{programName}</span>}
                              </div>
                              {slot.type !== 'rest' && (
                                <>
                                  <div className="schedule-session-time"><Clock size={13} /> {slot.start_time} – {slot.end_time}</div>
                                  {slot.location && <div className="schedule-session-location"><MapPin size={13} /> {slot.location}</div>}
                                </>
                              )}
                              {slot.notes && <p className="schedule-session-notes">{slot.notes}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
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

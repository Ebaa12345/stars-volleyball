import { useEffect, useRef, useState } from 'react'
import { supabase, Profile, Program, ProgramDayTime, ProgramDateTime, SessionAssignment, SessionType } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Save, Plus, Trash2,
  Search, ShieldCheck, User,
  MapPin, Clock, FileText, Percent,
  CalendarDays, Mail, Send, X, Check,
  CheckCircle2, XCircle, ClipboardCheck, ListChecks, Pencil, Image as ImageIcon
} from 'lucide-react'

interface ExtendedProfile extends Profile {}

interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  is_read: boolean
  created_at: string
}

const DAYS_SHORT = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня']
const TYPES: SessionType[] = ['practice', 'match', 'training', 'rest']
const TYPE_LABELS: Record<SessionType, string> = { practice: 'Дасгал', match: 'Тоглолт', training: 'Биеийн тамир', rest: 'Амралт' }
const TYPE_COLORS: Record<SessionType, string> = { practice: '#3b82f6', match: '#ef4444', training: '#10b981', rest: '#6b7280' }
const TYPE_BG: Record<SessionType, string> = { practice: 'rgba(59,130,246,0.08)', match: 'rgba(239,68,68,0.08)', training: 'rgba(16,185,129,0.08)', rest: 'rgba(107,114,128,0.08)' }

function parseDateStr(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { year: y, month: m, day: d }
}
function displayDate(dateStr: string) {
  const { month, day } = parseDateStr(dateStr)
  return `${month}/${day}`
}
function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const monthNames = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар']

function buildCalendarCells(month: Date) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstOfMonth = new Date(year, m, 1)
  const lastOfMonth = new Date(year, m + 1, 0)
  const startWeekday = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = lastOfMonth.getDate()
  const prevLast = new Date(year, m, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = startWeekday - 1; i >= 0; i--) cells.push({ date: new Date(year, m - 1, prevLast - i), inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, m, d), inMonth: true })
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date
    const next = new Date(last); next.setDate(last.getDate() + 1)
    cells.push({ date: next, inMonth: false })
    if (cells.length >= 42) break
  }
  return cells
}

type AttMonthMap = Record<string, { present: number; absent: number; userMap: Record<string, 'present' | 'absent'> }>

export default function Admin() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'schedule' | 'programs' | 'calendar' | 'attendance' | 'users' | 'contact'>('schedule')

  // Users
  const [users, setUsers] = useState<ExtendedProfile[]>([])
  const [allUsers, setAllUsers] = useState<ExtendedProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<ExtendedProfile | null>(null)
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [showCleanupPanel, setShowCleanupPanel] = useState(false)
  const [showCleanupMenu, setShowCleanupMenu] = useState(false)
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null)
  // Supabase Free (Nano) tier-ийн санал болгож буй дээд хэмжээ 500 MB
  const [dbSizeBytes, setDbSizeBytes] = useState<number | null>(null)
  const DB_LIMIT_BYTES = 500 * 1024 * 1024
  // Contact.tsx-ийн "Санал хүсэлт" формоос ирсэн зурвасууд
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([])
  const [contactLoading, setContactLoading] = useState(false)
  const unreadContactCount = contactMessages.filter(m => !m.is_read).length
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [profileDraft, setProfileDraft] = useState<{ position: string; jersey_number: string; avatar_url: string }>({ position: '', jersey_number: '', avatar_url: '' })
  const [profileSaving, setProfileSaving] = useState<string | null>(null)
  // Компьютер/утаснаас зураг сонгож Supabase Storage-руу upload хийх үед,
  // аль хэрэглэгчийн хувьд ачааллаж байгааг заана.
  const [avatarUploading, setAvatarUploading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // Programs catalog
  const [programs, setPrograms] = useState<Program[]>([])
  const [programForm, setProgramForm] = useState<{ id: string | null; name: string; start_time: string; end_time: string; location: string; type: SessionType; day_schedule: ProgramDayTime[]; date_schedule: ProgramDateTime[] }>({
    id: null, name: '', start_time: '18:00', end_time: '20:00', location: '', type: 'practice', day_schedule: [], date_schedule: []
  })
  const [savingProgram, setSavingProgram] = useState(false)
  // Тухайн Program дээр дарахад харагдах, тэр хөтөлбөрт хамрагдаж буй тоглогчид
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [programAssignments, setProgramAssignments] = useState<SessionAssignment[]>([])
  const [programAssignmentsLoading, setProgramAssignmentsLoading] = useState(false)
  // Programs tab дээрээс шууд ОЛОН хэрэглэгчийг сонгож, нэг дор энэ хөтөлбөрт оноох
  const [bulkAssignUserIds, setBulkAssignUserIds] = useState<Set<string>>(new Set())
  const [bulkAssigningProgram, setBulkAssigningProgram] = useState(false)
  // Хэрэглэгч сонгох жагсаалтыг нэг товч/label дор нээгддэг dropdown болгосон
  const [showBulkAssignPicker, setShowBulkAssignPicker] = useState(false)
  const [bulkAssignSearch, setBulkAssignSearch] = useState('')

  // Хөтөлбөрийн форм дээрх "📅 Огноо сонгох" — бүтэн сарын хуанли гарч,
  // admin шууд огноо дараад сонгодог/цуцалдаг
  const [showProgramDatePicker, setShowProgramDatePicker] = useState(false)
  const [programDatePickerMonth, setProgramDatePickerMonth] = useState(new Date())

  // Схедулийн зурган дээрх DAYS_SHORT ('Да'=Даваа...) индекс i-г JS Date.getDay()
  // утга (0=Ням...6=Бямба) руу хөрвүүлнэ, мөн эсрэгээр.
  const dayIdxToJsDay = (i: number) => (i + 1) % 7
  const jsDayToDayIdx = (d: number) => (d + 6) % 7

  // Schedule tab: per-user, per-date assignment (аль ч өдөр сонгоно, долоо хоног бүр давтагдахгүй)
  const [assignMonth, setAssignMonth] = useState(new Date())
  const [userAssignments, setUserAssignments] = useState<Record<string, SessionAssignment[]>>({})
  const [selectedAssignDate, setSelectedAssignDate] = useState<string | null>(null)
  const [newAssignProgramId, setNewAssignProgramId] = useState<string>('')
  // Хурдан оноолт: сар доторх тохирох (day_schedule/date_schedule) бүх өдөрт нэг дор оноох
  const [quickAssignProgramId, setQuickAssignProgramId] = useState<string>('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [newAssignStart, setNewAssignStart] = useState('18:00')
  const [newAssignEnd, setNewAssignEnd] = useState('20:00')
  const [newAssignLocation, setNewAssignLocation] = useState('')
  const [newAssignType, setNewAssignType] = useState<SessionType>('practice')
  const [newAssignNotes, setNewAssignNotes] = useState('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [limitDraft, setLimitDraft] = useState<number>(15)

  // Одоогийн бодит сарын "Ирсэн" тоо тоглогч бүрээр — Явцын багана дээр ашиглана
  const [thisMonthPresent, setThisMonthPresent] = useState<Record<string, number>>({})

  // Invite / шинэ хэрэглэгч үүсгэх (modal)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ type: 'success' | 'error', msg: string } | null>(null)

  // Attendance tab
  const [attendanceDate, setAttendanceDate] = useState(ymd(new Date()))
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'present' | 'absent'>>({})
  const [attendanceSaving, setAttendanceSaving] = useState<string | null>(null)
  const [attendanceSearch, setAttendanceSearch] = useState('')
  const [attMonth, setAttMonth] = useState(new Date())
  const [attMonthData, setAttMonthData] = useState<AttMonthMap>({})
  // Ирц бүртгэх дээр хөтөлбөрөөр шүүх — сонговол зөвхөн тэр хөтөлбөрт (ямар ч
  // огноогоор) оноогдож байсан тоглогчид л жагсаалтад гарч ирнэ.
  const [attendanceProgramFilter, setAttendanceProgramFilter] = useState('')
  const [programMemberIds, setProgramMemberIds] = useState<Set<string> | null>(null)

  // Calendar tab (нийт хуваарь)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null)
  const [monthAttendance, setMonthAttendance] = useState<AttMonthMap>({})
  const [monthAssignments, setMonthAssignments] = useState<Record<string, SessionAssignment[]>>({})

  // Шинэ хэрэглэгч үүсгэх үед supabase.auth.signUp() админы session-г түр
  // шинэ хэрэглэгчийн session рүү сольдог (Supabase JS-ийн зан төлөв). Тэр
  // богино мөчид useAuth-ийн isAdmin худал болж, доорх redirect ажиллаад
  // /admin-аас гарчихаж болзошгүй тул creatingUserRef=true үед л дарж түр
  // саатуулна — session-г буцааж сэргээмэгц ref буцаад false болно.
  const creatingUserRef = useRef(false)
  useEffect(() => { if (!loading && !isAdmin && !creatingUserRef.current) navigate('/') }, [isAdmin, loading, navigate])

  useEffect(() => { fetchUsers() }, [])
  useEffect(() => { fetchPrograms() }, [])
  useEffect(() => { fetchThisMonthPresent() }, [])
  useEffect(() => { fetchAttendance() }, [attendanceDate])
  useEffect(() => { if (attendanceProgramFilter) fetchProgramMembers(attendanceProgramFilter); else setProgramMemberIds(null) }, [attendanceProgramFilter])
  // Database-ийн одоогийн эзлэхүүнийг (Free tier 500MB-тай харьцуулах зорилгоор) татах
  useEffect(() => {
    async function fetchDbSize() {
      const { data, error } = await supabase.rpc('admin_get_db_size')
      if (!error && typeof data === 'number') setDbSizeBytes(data)
    }
    fetchDbSize()
  }, [])

  // Contact.tsx-ээс ирсэн санал хүсэлтийн зурвасууд — таб дэх "уншаагүй" тоог
  // байнга харуулахын тулд эхлээд mount дээр нэг татаад, дараа нь тухайн таб
  // руу орох бүрд дахин шинэчилнэ.
  async function fetchContactMessages() {
    setContactLoading(true)
    const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false })
    if (!error) setContactMessages((data as ContactMessage[]) || [])
    setContactLoading(false)
  }
  useEffect(() => { fetchContactMessages() }, [])
  useEffect(() => { if (activeTab === 'contact') fetchContactMessages() }, [activeTab])

  async function markContactRead(id: string, isRead: boolean) {
    const { error } = await supabase.from('contact_messages').update({ is_read: isRead }).eq('id', id)
    if (!error) setContactMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: isRead } : m))
  }

  async function deleteContactMessage(id: string) {
    if (!window.confirm('Энэ зурвасыг устгах уу?')) return
    const { error } = await supabase.from('contact_messages').delete().eq('id', id)
    if (!error) {
      setContactMessages(prev => prev.filter(m => m.id !== id))
      showToast('Зурвас устгагдлаа')
    } else {
      showToast('Алдаа: ' + error.message)
    }
  }
  useEffect(() => { fetchMonthAttendance(calendarMonth, setMonthAttendance) }, [calendarMonth])
  useEffect(() => { fetchMonthAttendance(attMonth, setAttMonthData) }, [attMonth])
  useEffect(() => { fetchMonthAssignments(calendarMonth) }, [calendarMonth])
  useEffect(() => { if (selectedUser) fetchUserAssignments(selectedUser.id, assignMonth) }, [selectedUser, assignMonth])
  useEffect(() => { setLimitDraft(selectedUser?.monthly_visit_limit || 15); setSelectedAssignDate(null) }, [selectedUser])

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name', { ascending: true })
    if (data) { setUsers(data as ExtendedProfile[]); setAllUsers(data as ExtendedProfile[]) }
  }

  async function fetchPrograms() {
    const { data } = await supabase.from('programs').select('*').order('start_time', { ascending: true })
    if (data) setPrograms(data as Program[])
  }

  async function fetchThisMonthPresent() {
    const now = new Date()
    const first = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
    const last = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    const { data } = await supabase.from('attendance').select('user_id, status').gte('date', first).lte('date', last)
    const counts: Record<string, number> = {}
    if (data) data.forEach(row => { if (row.status === 'present') counts[row.user_id] = (counts[row.user_id] || 0) + 1 })
    setThisMonthPresent(counts)
  }

  async function fetchMonthAttendance(month: Date, setter: (m: AttMonthMap) => void) {
    const year = month.getFullYear(); const m = month.getMonth()
    const firstDay = ymd(new Date(year, m, 1)); const lastDay = ymd(new Date(year, m + 1, 0))
    const { data } = await supabase.from('attendance').select('date, status, user_id').gte('date', firstDay).lte('date', lastDay)
    const map: AttMonthMap = {}
    if (data) data.forEach(row => {
      if (!map[row.date]) map[row.date] = { present: 0, absent: 0, userMap: {} }
      if (row.status === 'present') map[row.date].present++
      else map[row.date].absent++
      map[row.date].userMap[row.user_id] = row.status as 'present' | 'absent'
    })
    setter(map)
  }

  async function fetchMonthAssignments(month: Date) {
    const year = month.getFullYear(); const m = month.getMonth()
    const firstDay = ymd(new Date(year, m, 1)); const lastDay = ymd(new Date(year, m + 1, 0))
    const { data } = await supabase.from('session_assignments').select('*').gte('date', firstDay).lte('date', lastDay)
    const map: Record<string, SessionAssignment[]> = {}
    if (data) (data as SessionAssignment[]).forEach(a => { (map[a.date] ||= []).push(a) })
    setMonthAssignments(map)
  }

  async function fetchUserAssignments(userId: string, month: Date) {
    const year = month.getFullYear(); const m = month.getMonth()
    const firstDay = ymd(new Date(year, m, 1)); const lastDay = ymd(new Date(year, m + 1, 0))
    const { data } = await supabase.from('session_assignments').select('*').eq('user_id', userId).gte('date', firstDay).lte('date', lastDay).order('date')
    const map: Record<string, SessionAssignment[]> = {}
    if (data) (data as SessionAssignment[]).forEach(a => { (map[a.date] ||= []).push(a) })
    setUserAssignments(map)
  }

  async function fetchAttendance() {
    const { data } = await supabase.from('attendance').select('user_id, status').eq('date', attendanceDate)
    const map: Record<string, 'present' | 'absent'> = {}
    if (data) data.forEach(row => { map[row.user_id] = row.status as 'present' | 'absent' })
    setAttendanceMap(map)
  }

  // "Ирц бүртгэх"-ийн хөтөлбөрөөр шүүх сонголт: тухайн хөтөлбөрт ЯМАР Ч
  // огноогоор (зөвхөн сонгосон өдөр биш) оноогдож байсан бүх тоглогчийг
  // "гишүүн" гэж үзнэ — ингэснээр сонгосон өдөрт тухайлбал бас шинээр
  // ирц тэмдэглэх боломжтой болно (зөвхөн тэр өдрийн session_assignments
  // мөр байгаа хүмүүсийг харуулбал, шинэ өдөр дээр хараахан "Хурдан
  // оноолт" хийгээгүй үед жагсаалт хоосон гарч байсан асуудлыг засав).
  async function fetchProgramMembers(programId: string) {
    const { data } = await supabase.from('session_assignments').select('user_id').eq('program_id', programId)
    setProgramMemberIds(new Set((data || []).map((r: any) => r.user_id as string)))
  }

  async function markAttendance(userId: string, status: 'present' | 'absent' | 'unmarked') {
    setAttendanceSaving(userId)
    const d = attendanceDate
    try {
      if (status === 'unmarked') {
        const { error } = await supabase.from('attendance').delete().eq('user_id', userId).eq('date', d)
        if (!error) {
          setAttendanceMap(prev => { const next = { ...prev }; delete next[userId]; return next })
          setAttMonthData(prev => {
            const old = prev[d] || { present: 0, absent: 0, userMap: {} }
            const oldStatus = old.userMap[userId]
            const updatedUserMap = { ...old.userMap }
            delete updatedUserMap[userId]
            const updated = { ...old, userMap: updatedUserMap }
            if (oldStatus === 'present' && updated.present > 0) updated.present--
            if (oldStatus === 'absent' && updated.absent > 0) updated.absent--
            return { ...prev, [d]: updated }
          })
        }
      } else {
        const { error } = await supabase.from('attendance').upsert({ user_id: userId, date: d, status }, { onConflict: 'user_id,date' })
        if (!error) {
          setAttendanceMap(prev => ({ ...prev, [userId]: status }))
          setAttMonthData(prev => {
            const old = prev[d] || { present: 0, absent: 0, userMap: {} }
            const oldStatus = old.userMap[userId]
            const updated = { ...old, userMap: { ...old.userMap, [userId]: status } }
            if (oldStatus === 'present') updated.present--
            if (oldStatus === 'absent') updated.absent--
            if (status === 'present') updated.present++
            if (status === 'absent') updated.absent++
            return { ...prev, [d]: updated }
          })
        }
      }
      // Сарын лимитийн явц өөр tab-д зөв харагдахын тулд шинэчилнэ
      fetchThisMonthPresent()
    } catch (err) {
      console.error('Error marking attendance:', err)
    } finally {
      setAttendanceSaving(null)
    }
  }

  async function updateUserRole(userId: string, newRole: 'user' | 'admin' | 'coach') {
    setRoleUpdating(userId)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (!error) {
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      showToast('Role амжилттай өөрчлөгдлөө ✓')
    } else {
      showToast('Алдаа: ' + error.message)
    }
    setRoleUpdating(null)
  }

  // Компьютер/утаснаас (камер эсвэл галерей) зураг сонгуулж, Supabase
  // Storage-ийн "avatars" bucket рүү upload хийгээд, буцаж ирсэн public URL-г
  // profileDraft.avatar_url-д онооно ("Хадгалах" дарахад л profiles-д бичигдэнэ).
  async function uploadAvatar(userId: string, file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Зөвхөн зургийн файл (jpg, png гэх мэт) сонгоно уу.')
      return
    }
    setAvatarUploading(userId)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) {
        showToast('Зураг оруулахад алдаа гарлаа: ' + uploadError.message)
        setAvatarUploading(null)
        return
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setProfileDraft(d => ({ ...d, avatar_url: data.publicUrl }))
      showToast('Зураг орлоо — доор "Хадгалах" дарж баталгаажуулна уу')
    } catch (e: any) {
      showToast('Алдаа: ' + (e?.message || 'Зураг оруулахад алдаа гарлаа.'))
    }
    setAvatarUploading(null)
  }

  // Тоглогч/дасгалжуулагчийн танилцуулга (байрлал, дугаар, зураг) — Багийн
  // хуудсан дээр (Team.tsx) харагдана. "Дэлгэрэнгүй" panel-аас засна.
  async function saveUserProfile(userId: string, patch: { position: string; jersey_number: string; avatar_url: string }) {
    setProfileSaving(userId)
    const { error } = await supabase.from('profiles').update({
      position: patch.position || null,
      jersey_number: patch.jersey_number ? Number(patch.jersey_number) : null,
      avatar_url: patch.avatar_url || null,
    }).eq('id', userId)
    if (!error) {
      const merge = (u: ExtendedProfile) => u.id === userId ? { ...u, position: patch.position, jersey_number: patch.jersey_number ? Number(patch.jersey_number) : undefined, avatar_url: patch.avatar_url } : u
      setAllUsers(prev => prev.map(merge))
      setUsers(prev => prev.map(merge))
      showToast('Профайл хадгалагдлаа ✓')
      setExpandedUserId(null)
    } else {
      showToast('Алдаа: ' + error.message)
    }
    setProfileSaving(null)
  }

  function toggleExpandUser(u: ExtendedProfile) {
    if (expandedUserId === u.id) { setExpandedUserId(null); return }
    setExpandedUserId(u.id)
    setProfileDraft({
      position: u.position || '',
      jersey_number: u.jersey_number != null ? String(u.jersey_number) : '',
      avatar_url: u.avatar_url || '',
    })
  }

  // Хэрэглэгчийг бүрмөсөн устгах — Edge Function (admin-users) дуудаж, зөвхөн
  // profiles-оос биш, Supabase Auth (auth.users)-ээс ч бодитоор устгана.
  // auth.users-ээс шууд устгадаг SQL функц (admin_delete_user) дуудна —
  // Edge Function шаардахгүй. auth.users устахад profiles мөр нь FK cascade-аар
  // автоматаар дагаж устдаг тул хэрэглэгч database-ийн ХОЁР талаас (auth + profiles)
  // бүрмөсөн устна.
  async function deleteUser(userId: string, name: string) {
    if (!window.confirm(`${name}-г бүрмөсөн устгах уу? Нэвтрэх эрх (auth) болон холбоотой хуваарь, ирцийн бүртгэл бүгд устна. Энэ үйлдлийг буцаах боломжгүй.`)) return
    setDeletingUserId(userId)
    try {
      const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
      if (!error) {
        setAllUsers(prev => prev.filter(u => u.id !== userId))
        setUsers(prev => prev.filter(u => u.id !== userId))
        if (selectedUser?.id === userId) setSelectedUser(null)
        showToast('Хэрэглэгч бүрмөсөн устгагдлаа')
      } else {
        showToast('Алдаа: ' + error.message)
      }
    } catch (e: any) {
      showToast('Алдаа: ' + (e?.message || 'Устгахад алдаа гарлаа.'))
    }
    setDeletingUserId(null)
  }

  // Санамсаргүй, амархан унших боломжтой нууц үг үүсгэнэ (тэр хүнд admin
  // өөрөө утас/Messenger-ээр дамжуулна).
  function generateInvitePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pass = ''
    for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)]
    setInvitePassword(pass)
  }

  // Шинэ хэрэглэгч үүсгэх — Edge Function ШААРДАХГҮЙ: client талын supabase.auth.signUp() ашиглаад,
  // дуудахаас өмнө админы session-г хадгалж аваад, дараа нь буцааж сэргээнэ.
  // ЗААВАЛ шаардлагатай: Supabase Dashboard → Authentication → Providers →
  // Email → "Confirm email" УНТАРСАН байх ёстой (үгүй бол шинэ хэрэглэгч
  // email баталгаажуулаагүй тул session буцаж ирэхгүй, мөн нэвтэрч чадахгүй).
  async function sendInvite() {
    if (!inviteEmail.trim() || !invitePassword.trim()) return
    setInviteSending(true)
    setInviteResult(null)
    const targetEmail = inviteEmail.trim()
    const targetName = inviteName.trim() || targetEmail.split('@')[0]
    const targetPassword = invitePassword.trim()
    creatingUserRef.current = true
    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession()

      const { error } = await supabase.auth.signUp({
        email: targetEmail,
        password: targetPassword,
        options: { data: { full_name: targetName } },
      })

      // Админы session-г нэн даруй сэргээнэ — signUp амжилттай/амжилтгүй
      // эсэхээс үл хамаарна (амжилтгүй бол ч гэсэн session солигдсон байж болзошгүй).
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
      }

      if (error) {
        const msg = error.message || ''
        const friendly = msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')
          ? `${targetEmail} хаяг аль хэдийн бүртгэлтэй байна.`
          : (msg || 'Хэрэглэгч үүсгэхэд алдаа гарлаа.')
        setInviteResult({ type: 'error', msg: friendly })
        setInviteSending(false)
        creatingUserRef.current = false
        return
      }

      setInviteResult({
        type: 'success',
        msg: `${targetName} (${targetEmail}) амжилттай үүслээ. Нууц үг: ${targetPassword} — үүнийг тэр хүнд өөрөө дамжуулна уу.`,
      })
      setInviteName(''); setInviteEmail(''); setInvitePassword('')
      fetchUsers()
    } catch (error: any) {
      console.error('Create user error:', error)
      setInviteResult({ type: 'error', msg: error?.message || 'Хэрэглэгч үүсгэхэд алдаа гарлаа.' })
    } finally {
      setInviteSending(false)
      creatingUserRef.current = false
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Schedule tab: session assignment CRUD ──
  function applyProgramToForm(programId: string) {
    setNewAssignProgramId(programId)
    const p = programs.find(pr => pr.id === programId)
    if (p) {
      setNewAssignStart(p.start_time); setNewAssignEnd(p.end_time)
      setNewAssignLocation(p.location); setNewAssignType(p.type)
    }
  }

  async function addAssignment() {
    if (!selectedUser || !selectedAssignDate) return
    setSavingAssignment(true)
    const { error } = await supabase.from('session_assignments').insert({
      user_id: selectedUser.id,
      date: selectedAssignDate,
      program_id: newAssignProgramId || null,
      start_time: newAssignStart,
      end_time: newAssignEnd,
      location: newAssignLocation,
      type: newAssignType,
      notes: newAssignNotes,
      created_by: 'admin',
    })
    if (!error) {
      showToast('Хуваарь нэмэгдлээ ✓')
      setNewAssignLocation(''); setNewAssignNotes('')
      fetchUserAssignments(selectedUser.id, assignMonth)
      fetchMonthAssignments(calendarMonth)
    } else if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate')) {
      showToast('Энэ өдөрт яг ийм цагаар аль хэдийн хуваарь байна.')
    } else {
      showToast('Алдаа: ' + error.message)
    }
    setSavingAssignment(false)
  }

  // "Хурдан оноолт": day_schedule-ийн тохирох өдрүүд + date_schedule дундаас
  // одоо харагдаж буй сард (assignMonth) багтах бүх огноог нэгтгэж, ӨДӨР/ОГНОО
  // ТУС БҮРИЙН ӨӨРИЙН ЦАГААР нь оноодог. date_schedule нь day_schedule-ээс
  // тэргүүлнэ (тухайн өдөр аль алинд нь давхацвал тодорхой огнооных нь цаг үлдэнэ).
  // Тухайн өдөрт энэ хөтөлбөр аль хэдийн оноогдсон бол давхардуулахгүй.
  async function bulkAssignProgramToMonth() {
    if (!selectedUser || !quickAssignProgramId) return
    const program = programs.find(p => p.id === quickAssignProgramId)
    if (!program) return
    const daySchedule = program.day_schedule || []
    const dateSchedule = program.date_schedule || []
    if (daySchedule.length === 0 && dateSchedule.length === 0) return

    setBulkAssigning(true)
    const year = assignMonth.getFullYear()
    const month = assignMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`

    // dateStr -> {start_time, end_time} — тухайн өдрийн цаг
    const targetDates = new Map<string, { start_time: string; end_time: string }>()
    if (daySchedule.length > 0) {
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d)
        const match = daySchedule.find(ds => ds.day === date.getDay())
        if (match) targetDates.set(ymd(date), { start_time: match.start_time, end_time: match.end_time })
      }
    }
    if (dateSchedule.length > 0) {
      dateSchedule.filter(ds => ds.date.startsWith(monthPrefix)).forEach(ds => {
        targetDates.set(ds.date, { start_time: ds.start_time, end_time: ds.end_time })
      })
    }

    const rows: any[] = []
    targetDates.forEach((time, dateStr) => {
      const already = (userAssignments[dateStr] || []).some(a => a.program_id === program.id)
      if (already) return
      rows.push({
        user_id: selectedUser.id,
        date: dateStr,
        program_id: program.id,
        start_time: time.start_time,
        end_time: time.end_time,
        location: program.location,
        type: program.type,
        notes: '',
        created_by: 'admin',
      })
    })

    if (rows.length === 0) {
      showToast('Бүх тохирох өдөр аль хэдийн оноогдсон байна.')
      setBulkAssigning(false)
      return
    }

    // upsert + ignoreDuplicates ашиглаж байгаа шалтгаан: session_assignments
    // хүснэгтэд (user_id, date, start_time) unique constraint байдаг тул хэрэв
    // сонгосон огноонуудын аль нэг дээр аль хэдийн адилхан цагтай хуваарь
    // байвал plain insert() БҮХ мөрийг цуг татгалзаж 409 өгдөг байсан.
    // ignoreDuplicates: true бол зөрчилтэй мөрүүдийг л алгасаад, шинэ
    // мөрүүдийг амжилттай нэмнэ.
    const { error } = await supabase.from('session_assignments').upsert(rows, {
      onConflict: 'user_id,date,start_time',
      ignoreDuplicates: true,
    })
    if (!error) {
      showToast(`${rows.length} өдөрт "${program.name}" амжилттай оноолоо ✓`)
      fetchUserAssignments(selectedUser.id, assignMonth)
      fetchMonthAssignments(calendarMonth)
    } else {
      showToast('Алдаа: ' + error.message)
    }
    setBulkAssigning(false)
  }

  async function removeAssignment(id: string) {
    const { error } = await supabase.from('session_assignments').delete().eq('id', id)
    if (!error) {
      if (selectedUser) fetchUserAssignments(selectedUser.id, assignMonth)
      fetchMonthAssignments(calendarMonth)
      showToast('Хуваарь устгагдлаа')
    } else {
      showToast('Алдаа: ' + error.message)
    }
  }

  // Supabase Free tier-ийн 500MB хязгаарт хүрэхээс сэргийлж, хуучирсан
  // (заасан сарын тооноос өмнөх) session_assignments болон attendance
  // мөрүүдийг гараар цэвэрлэх. Эхлээд хэдэн мөр байгааг тоолж баталгаажуулж
  // асуугаад, зөвшөөрсний дараа устгана.
  async function cleanupOldData(monthsBack: number) {
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack)
    const cutoff = ymd(cutoffDate)
    setCleanupLoading(true)
    try {
      const [{ count: schedCount }, { count: attCount }] = await Promise.all([
        supabase.from('session_assignments').select('id', { count: 'exact', head: true }).lt('date', cutoff),
        supabase.from('attendance').select('user_id', { count: 'exact', head: true }).lt('date', cutoff),
      ])
      const total = (schedCount || 0) + (attCount || 0)
      if (total === 0) {
        showToast(`${displayDate(cutoff)}-с өмнөх устгах өгөгдөл алга`)
        setCleanupLoading(false)
        return
      }
      if (!window.confirm(`${displayDate(cutoff)}-с ӨМНӨХ бүх хуваарь (${schedCount || 0} мөр) болон ирцийн (${attCount || 0} мөр) бүртгэл — нийт ${total} мөрийг бүрмөсөн устгах уу?\n\nЭнэ үйлдлийг буцаах боломжгүй бөгөөд эдгээр өдрүүдийн түүхэн ирц/хуваарь бүрэн устна.`)) {
        setCleanupLoading(false)
        return
      }
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('session_assignments').delete().lt('date', cutoff),
        supabase.from('attendance').delete().lt('date', cutoff),
      ])
      if (!e1 && !e2) {
        showToast(`${total} хуучин мөр устгагдлаа ✓`)
        fetchMonthAssignments(calendarMonth)
        fetchMonthAttendance(calendarMonth, setMonthAttendance)
        if (selectedUser) fetchUserAssignments(selectedUser.id, assignMonth)
      } else {
        showToast('Алдаа: ' + (e1?.message || e2?.message))
      }
    } catch (e: any) {
      showToast('Алдаа: ' + (e?.message || 'Устгахад алдаа гарлаа.'))
    }
    setCleanupLoading(false)
  }

  async function saveLimit() {
    if (!selectedUser) return
    const { error } = await supabase.from('profiles').update({ monthly_visit_limit: limitDraft }).eq('id', selectedUser.id)
    if (!error) {
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, monthly_visit_limit: limitDraft } : u))
      setSelectedUser(prev => prev ? { ...prev, monthly_visit_limit: limitDraft } : prev)
      showToast('Сарын лимит хадгалагдлаа ✓')
    }
  }

  // ── Programs CRUD ──
  function resetProgramForm() { setProgramForm({ id: null, name: '', start_time: '18:00', end_time: '20:00', location: '', type: 'practice', day_schedule: [], date_schedule: [] }) }

  function editProgram(p: Program) {
    // Хуучин (days_of_week/specific_dates) өгөгдөлтэй, гэвч шинэ
    // day_schedule/date_schedule хараахан (migration-аар) бөглөгдөөгүй бол —
    // хамгаалалт болгож клиент талд нь хөрвүүлж өгнө.
    const day_schedule = (p.day_schedule && p.day_schedule.length > 0)
      ? p.day_schedule
      : (p.days_of_week || []).map(d => ({ day: d, start_time: p.start_time, end_time: p.end_time }))
    const date_schedule = (p.date_schedule && p.date_schedule.length > 0)
      ? p.date_schedule
      : (p.specific_dates || []).map(d => ({ date: d, start_time: p.start_time, end_time: p.end_time }))
    setProgramForm({ id: p.id, name: p.name, start_time: p.start_time, end_time: p.end_time, location: p.location, type: p.type, day_schedule, date_schedule })
  }

  // Хөтөлбөрийн форм дээрх өдрийн товч (Да/Мя/Лх/...) дарахад тухайн jsDay-г
  // day_schedule массивт нэмэх (Program-ий ерөнхий цагийг эхний утга болгоно)/хасах
  function toggleProgramDay(jsDay: number) {
    setProgramForm(f => {
      const has = f.day_schedule.some(d => d.day === jsDay)
      return {
        ...f,
        day_schedule: has
          ? f.day_schedule.filter(d => d.day !== jsDay)
          : [...f.day_schedule, { day: jsDay, start_time: f.start_time, end_time: f.end_time }].sort((a, b) => a.day - b.day),
      }
    })
  }

  // Сонгосон өдрийн (day_schedule мөрийн) эхлэх/дуусах цагийг тухайлан засах
  function updateProgramDayTime(jsDay: number, field: 'start_time' | 'end_time', value: string) {
    setProgramForm(f => ({
      ...f,
      day_schedule: f.day_schedule.map(d => d.day === jsDay ? { ...d, [field]: value } : d),
    }))
  }

  // "📅 Огноо сонгох" хуанли дээр огноо дарахад date_schedule массивт
  // нэмэх (Program-ий ерөнхий цагийг эхний утга болгоно)/хасах
  function toggleProgramSpecificDate(dateStr: string) {
    setProgramForm(f => {
      const has = f.date_schedule.some(d => d.date === dateStr)
      return {
        ...f,
        date_schedule: has
          ? f.date_schedule.filter(d => d.date !== dateStr)
          : [...f.date_schedule, { date: dateStr, start_time: f.start_time, end_time: f.end_time }].sort((a, b) => a.date.localeCompare(b.date)),
      }
    })
  }

  // Сонгосон огнооны (date_schedule мөрийн) эхлэх/дуусах цагийг тухайлан засах
  function updateProgramDateTime(dateStr: string, field: 'start_time' | 'end_time', value: string) {
    setProgramForm(f => ({
      ...f,
      date_schedule: f.date_schedule.map(d => d.date === dateStr ? { ...d, [field]: value } : d),
    }))
  }

  async function saveProgram() {
    if (!programForm.name.trim()) return
    setSavingProgram(true)
    if (programForm.id) {
      const { error } = await supabase.from('programs').update({
        name: programForm.name, start_time: programForm.start_time, end_time: programForm.end_time,
        location: programForm.location, type: programForm.type, day_schedule: programForm.day_schedule,
        date_schedule: programForm.date_schedule,
      }).eq('id', programForm.id)
      if (!error) showToast('Хөтөлбөр шинэчлэгдлээ ✓')
    } else {
      const { error } = await supabase.from('programs').insert({
        name: programForm.name, start_time: programForm.start_time, end_time: programForm.end_time,
        location: programForm.location, type: programForm.type, day_schedule: programForm.day_schedule,
        date_schedule: programForm.date_schedule,
      })
      if (!error) showToast('Хөтөлбөр нэмэгдлээ ✓')
    }
    setSavingProgram(false)
    resetProgramForm()
    fetchPrograms()
  }

  // Хөтөлбөрийг устгахдаа, холбогдох session_assignments мөрүүдийг ЭХЛЭЭД
  // өөрсдийг нь устгана — учир нь programs.id FK нь "on delete set null" тул
  // хөтөлбөрийг эхэлж устгачихвал program_id багана нь null болоод, тэдгээр
  // хуваарийг дараа нь олж устгах боломжгүй болно (Нийт хуваарь дээр "эзэнгүй"
  // хэвээр үлдэнэ гэсэн үг).
  async function deleteProgram(id: string, name?: string) {
    if (!window.confirm(`${name ? `"${name}"` : 'Энэ'} хөтөлбөрийг устгах уу? Холбогдох бүх хуваарь (Нийт хуваарь дээрх) мөн бүрмөсөн устна. Энэ үйлдлийг буцаах боломжгүй.`)) return
    await supabase.from('session_assignments').delete().eq('program_id', id)
    const { error } = await supabase.from('programs').delete().eq('id', id)
    if (!error) {
      showToast('Хөтөлбөр болон холбогдох хуваарь устгагдлаа')
      fetchPrograms()
      fetchMonthAssignments(calendarMonth)
      if (selectedProgramId === id) setSelectedProgramId(null)
    } else {
      showToast('Алдаа: ' + error.message)
    }
  }

  async function toggleProgramActive(p: Program) {
    const { error } = await supabase.from('programs').update({ active: !p.active }).eq('id', p.id)
    if (!error) fetchPrograms()
  }

  // Тухайн Program дээр дарахад — энэ хөтөлбөрт хамрагдаж буй тоглогчдыг харах
  async function viewProgramUsers(programId: string) {
    if (selectedProgramId === programId) { setSelectedProgramId(null); return }
    setSelectedProgramId(programId)
    setBulkAssignUserIds(new Set())
    setShowBulkAssignPicker(false)
    setBulkAssignSearch('')
    await refetchProgramAssignments(programId)
  }

  async function refetchProgramAssignments(programId: string) {
    setProgramAssignmentsLoading(true)
    const { data } = await supabase.from('session_assignments').select('*').eq('program_id', programId).order('date', { ascending: false })
    setProgramAssignments((data as SessionAssignment[]) || [])
    setProgramAssignmentsLoading(false)
  }

  // Programs tab-с шууд ОЛОН хэрэглэгчийг сонгоод, тэдэнд бүгдэд нь энэ
  // хөтөлбөрийг нэг товчлуураар оноох (Schedule tab-руу орж хүн бүрийг
  // тусад нь дайрч "Хурдан оноолт" хийх шаардлагагүй болгоно).
  //   - date_schedule (тодорхой огноонууд): АЛЬ Ч сар үл хамааран, бүгдийг оноодог.
  //   - day_schedule (долоо хоногийн давтамж): өнөөдрөөс хойш ойролцоогоор 3 сарын
  //     (92 өдөр) хугацаанд тохирох өдрүүдийг урьдчилан үүсгэж өгнө.
  async function bulkAssignProgramToUsers(program: Program, userIds: string[]) {
    if (userIds.length === 0) return
    const daySchedule = program.day_schedule || []
    const dateSchedule = program.date_schedule || []
    if (daySchedule.length === 0 && dateSchedule.length === 0) {
      showToast('Энэ хөтөлбөрт өдөр/огноо сонгогдоогүй байна. Дээрх "Хөтөлбөр засах" form-оор нэмнэ үү.')
      return
    }
    setBulkAssigningProgram(true)

    const targetDates = new Map<string, { start_time: string; end_time: string }>()
    if (daySchedule.length > 0) {
      const start = new Date()
      for (let i = 0; i < 92; i++) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
        const match = daySchedule.find(ds => ds.day === date.getDay())
        if (match) targetDates.set(ymd(date), { start_time: match.start_time, end_time: match.end_time })
      }
    }
    dateSchedule.forEach(ds => targetDates.set(ds.date, { start_time: ds.start_time, end_time: ds.end_time }))

    const rows: any[] = []
    userIds.forEach(uid => {
      targetDates.forEach((time, dateStr) => {
        rows.push({
          user_id: uid,
          date: dateStr,
          program_id: program.id,
          start_time: time.start_time,
          end_time: time.end_time,
          location: program.location,
          type: program.type,
          notes: '',
          created_by: 'admin',
        })
      })
    })

    const { error } = await supabase.from('session_assignments').upsert(rows, {
      onConflict: 'user_id,date,start_time',
      ignoreDuplicates: true,
    })
    if (!error) {
      showToast(`${userIds.length} хэрэглэгчид "${program.name}" амжилттай оноолоо ✓ (${targetDates.size} огноо тус бүрд)`)
      setBulkAssignUserIds(new Set())
      setShowBulkAssignPicker(false)
      refetchProgramAssignments(program.id)
      fetchMonthAssignments(calendarMonth)
    } else {
      showToast('Алдаа: ' + error.message)
    }
    setBulkAssigningProgram(false)
  }

  // Хэрэглэгчийг энэ хөтөлбөрөөс БҮРЭН хасах — тухайн хэрэглэгчийн энэ
  // program_id-тай холбоотой session_assignments мөрүүдийг бүгдийг устгана
  // (өөр хөтөлбөр/дурын цагаар оноосон хуваарьд нь нөлөөлөхгүй).
  async function removeUserFromProgram(programId: string, userId: string, userName: string, count: number) {
    if (!window.confirm(`${userName}-г энэ хөтөлбөрөөс хасах уу? Холбогдох ${count} өдрийн хуваарь устна.`)) return
    const { error } = await supabase.from('session_assignments').delete().eq('program_id', programId).eq('user_id', userId)
    if (!error) {
      showToast(`${userName}-г хөтөлбөрөөс хаслаа`)
      refetchProgramAssignments(programId)
      fetchMonthAssignments(calendarMonth)
    } else {
      showToast('Алдаа: ' + error.message)
    }
  }

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredAllUsers = allUsers.filter(u =>
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  // ── Нийт хуваарь (calendar) tab grid ──
  const calYear = calendarMonth.getFullYear()
  const calMonthIdx = calendarMonth.getMonth()
  const calendarCells = buildCalendarCells(calendarMonth)
  const todayStr = ymd(new Date())
  const selectedDateAssignments = calendarSelectedDate ? (monthAssignments[calendarSelectedDate] || []) : []

  // ── Schedule tab mini-calendar ──
  const assignCells = buildCalendarCells(assignMonth)
  const assignMonthIdx = assignMonth.getMonth()
  const assignYear = assignMonth.getFullYear()
  const selectedDateUserAssignments = selectedAssignDate ? (userAssignments[selectedAssignDate] || []) : []

  // ── Attendance tab calendar ──
  const attCells = buildCalendarCells(attMonth)
  const attMonthIdx = attMonth.getMonth()
  const attYear = attMonth.getFullYear()

  // Хөтөлбөрөөр шүүсэн бол зөвхөн тэр хөтөлбөрт (ямар ч огноогоор) оноогдож
  // байсан тоглогчид, эсэрэг тохиолдолд бүх тоглогч (нэрээр хайлт хоёулаа AND).
  const attendanceProgramUserIds = attendanceProgramFilter ? programMemberIds : null
  const visibleAttendanceUsers = users
    .filter(u => u.full_name?.toLowerCase().includes(attendanceSearch.toLowerCase()))
    .filter(u => !attendanceProgramUserIds || attendanceProgramUserIds.has(u.id))

  return (
    <div className="page admin-page">
      <div className="container">

        {/* Header */}
        <div className="admin-header">
          <div>
            <span className="eyebrow admin-eyebrow">Admin панел</span>
            <h1>Удирдлагын самбар</h1>
          </div>
          {toast && <div className="save-toast">{toast}</div>}
        </div>

        {/* Sidebar + content layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Sidebar nav */}
          <div style={{ background: 'rgba(20,27,47,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 10, position: 'sticky', top: 80 }}>
            {([
              { key: 'schedule', label: 'Хуваарь оноох', icon: '📅' },
              { key: 'programs', label: 'Хөтөлбөрүүд', icon: '🗂' },
              { key: 'calendar', label: 'Нийт хуваарь', icon: '🗓' },
              { key: 'attendance', label: 'Ирц бүртгэл', icon: '✅' },
              { key: 'users', label: 'Хэрэглэгчид', icon: '👥' },
              { key: 'contact', label: 'Санал хүсэлт', icon: '✉️' },
            ] as const).map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 10, border: 'none',
                  background: activeTab === tab.key ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: activeTab === tab.key ? '#60a5fa' : '#9ca3af',
                  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  textAlign: 'left', transition: 'all .15s',
                  borderLeft: activeTab === tab.key ? '3px solid #3b82f6' : '3px solid transparent',
                  marginBottom: 2,
                }}>
                <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
                {tab.label}
                {tab.key === 'contact' && unreadContactCount > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.68rem', fontWeight: 800, borderRadius: 10, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>
                    {unreadContactCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div>

        {/* ══════════ ХУВААРЬ ОНООХ ══════════ */}
        {activeTab === 'schedule' && (
          <div>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px', marginBottom: 16, maxWidth: 400 }}>
              <Search size={15} style={{ color: '#6b7280' }} />
              <input type="text" placeholder="Тоглогч хайх..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '100%' }} />
            </div>

            {/* User summary table — Явц = энэ сарын Ирсэн тоо / сарын лимит (удаа) */}
            <div style={{ overflowX: 'auto', background: 'rgba(20,27,47,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, marginBottom: 28 }}>
              <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Тоглогч', 'Role', 'Сарын лимит', 'Ирсэн (энэ сар)', 'Явц', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const visits = thisMonthPresent[u.id] || 0
                    const limit = u.monthly_visit_limit || 15
                    const pct = Math.min(100, Math.round((visits / limit) * 100))
                    const sc = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#3b82f6'
                    const isSel = selectedUser?.id === u.id
                    return (
                      <tr key={u.id} onClick={() => setSelectedUser(u)}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isSel ? 'rgba(59,130,246,0.06)' : 'transparent', cursor: 'pointer' }}>
                        <td style={{ padding: '14px 16px', maxWidth: 260 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <User size={16} style={{ color: '#6b7280' }} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name}</div>
                              <div style={{ fontSize: '0.78rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          <span style={{ display: 'inline-flex', flexShrink: 0, alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap', gap: 4, lineHeight: 1, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 10, background: u.role === 'admin' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)', color: u.role === 'admin' ? '#f97316' : '#9ca3af', border: `1px solid ${u.role === 'admin' ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                            <span style={{ lineHeight: 1 }}>{u.role === 'admin' ? '⚡' : '👤'}</span>
                            <span style={{ lineHeight: 1, whiteSpace: 'nowrap' }}>{u.role === 'admin' ? 'Admin' : 'User'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>{limit} удаа</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: sc, whiteSpace: 'nowrap' }}>{visits} удаа</td>
                        <td style={{ padding: '14px 16px', width: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: sc }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: sc, minWidth: 32 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button onClick={e => { e.stopPropagation(); setSelectedUser(u) }}
                            style={{ background: isSel ? '#3b82f6' : 'rgba(255,255,255,0.04)', border: 'none', color: isSel ? '#fff' : '#9ca3af', padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                            {isSel ? '✓ Сонгогдсон' : 'Засах'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Assignment editor */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start', marginTop: 12 }}>

              {/* ЗҮҮН ТАЛ: Тоглогчдын жагсаалт */}
              <div style={{ background: 'rgba(17, 24, 39, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 16, backdropFilter: 'blur(12px)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Тоглогчид</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 600, overflowY: 'auto' }}>
                  {users.map(u => {
                    const isUserSelected = selectedUser?.id === u.id
                    return (
                      <button key={u.id} onClick={() => setSelectedUser(u)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                          background: isUserSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                          border: `1px solid ${isUserSelected ? 'rgba(59, 130, 246, 0.25)' : 'transparent'}`,
                          borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                        }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: isUserSelected ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${isUserSelected ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                          color: isUserSelected ? '#fff' : '#9ca3af', fontSize: '0.8rem', fontWeight: 600
                        }}>
                          {u.full_name?.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: isUserSelected ? 700 : 500, color: isUserSelected ? '#60a5fa' : '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {u.full_name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* БАРУУН ТАЛ: Сар доторх аль ч өдөрт хуваарь оноох */}
              <div>
                {!selectedUser ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', background: 'rgba(17, 24, 39, 0.25)', border: '2px dashed rgba(255,255,255,0.06)', borderRadius: 20, textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                    <CalendarDays size={36} style={{ color: '#4b5563', marginBottom: 16 }} />
                    <h3 style={{ color: '#fff', fontSize: '1.05rem', margin: '0 0 6px 0', fontWeight: 600 }}>Тоглогч сонгоогүй байна</h3>
                    <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: 0, maxWidth: 280, lineHeight: 1.4 }}>Хуваарь оноохын тулд зүүн талын жагсаалтаас тоглогч сонгоно уу.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Top bar: нэр, сарын лимит, сар солих */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(17, 24, 39, 0.45)', border: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', borderRadius: 16, flexWrap: 'wrap', gap: 16, backdropFilter: 'blur(12px)' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.3px' }}>
                          <span style={{ color: '#3b82f6' }}>{selectedUser.full_name}</span>-д хуваарь оноох
                        </h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15, 23, 42, 0.6)', padding: '6px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                          <Percent size={14} style={{ color: '#3b82f6' }} />
                          <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>Сарын лимит:</span>
                          <input type="number" min={1}
                            value={limitDraft}
                            onChange={e => setLimitDraft(Number(e.target.value))}
                            style={{ width: 48, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '5px 4px', fontWeight: 800, textAlign: 'center', outline: 'none', fontSize: '0.9rem' }} />
                          <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>удаа</span>
                          {limitDraft !== (selectedUser.monthly_visit_limit || 15) && (
                            <button onClick={saveLimit} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Save size={12} /> Хадгалах
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(15, 23, 42, 0.6)', padding: '5px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                          <button onClick={() => setAssignMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={{ background: 'none', border: 'none', color: '#9ca3af', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', minWidth: 100, textAlign: 'center', letterSpacing: '0.3px' }}>{monthNames[assignMonthIdx]} {assignYear}</span>
                          <button onClick={() => setAssignMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{ background: 'none', border: 'none', color: '#9ca3af', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
                        </div>
                      </div>
                    </div>

                    {/* Хурдан оноолт: долоо хоногийн давтамжтай хөтөлбөрийг
                        энэ сарын бүх тохирох өдөрт нэг дор оноох */}
                    {programs.some(p => (p.day_schedule && p.day_schedule.length > 0) || (p.date_schedule && p.date_schedule.length > 0)) && (
                      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                          🔁 Хурдан оноолт:
                        </span>
                        <select value={quickAssignProgramId} onChange={e => setQuickAssignProgramId(e.target.value)}
                          style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '9px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none', flex: '1 1 220px' }}>
                          <option value="">— Давтамжтай хөтөлбөр сонгох —</option>
                          {programs.filter(p => (p.day_schedule && p.day_schedule.length > 0) || (p.date_schedule && p.date_schedule.length > 0)).map(p => {
                            const parts: string[] = []
                            if (p.day_schedule && p.day_schedule.length > 0) parts.push(p.day_schedule.map(ds => DAYS_SHORT[jsDayToDayIdx(ds.day)]).join(','))
                            if (p.date_schedule && p.date_schedule.length > 0) parts.push(`${p.date_schedule.length} огноо`)
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({parts.join(' + ')})
                              </option>
                            )
                          })}
                        </select>
                        <button onClick={bulkAssignProgramToMonth} disabled={!quickAssignProgramId || bulkAssigning}
                          style={{ background: '#3b82f6', color: '#fff', padding: '9px 18px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.83rem', opacity: !quickAssignProgramId ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                          {bulkAssigning ? 'Оноож байна...' : `${monthNames[assignMonthIdx]}-д бүгдэд нь оноох`}
                        </button>
                      </div>
                    )}

                    {/* Сарын хуанли: аль ч өдрийг сонгоод хуваарь оноох — жижиг, багахан зай эзэлдэг хувилбар */}
                    <div style={{ background: 'rgba(17, 24, 39, 0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, maxWidth: 320 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                        {DAYS_SHORT.map(d => (
                          <div key={d} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', padding: '2px 0', textTransform: 'uppercase' }}>{d}</div>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                        {assignCells.map((cell, idx) => {
                          const dateStr = ymd(cell.date)
                          const isToday = dateStr === todayStr
                          const isSelected = selectedAssignDate === dateStr
                          const count = userAssignments[dateStr]?.length || 0
                          return (
                            <button key={idx}
                              onClick={() => cell.inMonth && setSelectedAssignDate(isSelected ? null : dateStr)}
                              disabled={!cell.inMonth}
                              style={{
                                aspectRatio: '1', minHeight: 30,
                                background: isSelected ? 'rgba(59,130,246,0.18)' : isToday ? 'rgba(59,130,246,0.08)' : 'rgba(10,14,26,0.3)',
                                border: isSelected ? '2px solid #3b82f6' : isToday ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.04)',
                                borderRadius: 7, padding: '2px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                                cursor: cell.inMonth ? 'pointer' : 'default', opacity: cell.inMonth ? 1 : 0.3, transition: 'all .15s'
                              }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#60a5fa' : cell.inMonth ? '#e5e7eb' : '#4b5563', lineHeight: 1 }}>{cell.date.getDate()}</span>
                              {count > 0 && (
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#60a5fa' }} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Сонгосон өдрийн хуваарийн жагсаалт + нэмэх form */}
                    {selectedAssignDate && (
                      <div style={{ background: 'rgba(17, 24, 39, 0.45)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, padding: 20 }}>
                        <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                          {displayDate(selectedAssignDate)} — {selectedUser.full_name}
                        </h4>

                        {selectedDateUserAssignments.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                            {selectedDateUserAssignments.map(a => (
                              <div key={a.id} style={{ borderLeft: `4px solid ${TYPE_COLORS[a.type]}`, background: TYPE_BG[a.type], padding: 12, borderRadius: '6px 12px 12px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ color: TYPE_COLORS[a.type], fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>{TYPE_LABELS[a.type]}</span>
                                    {a.type !== 'rest' && <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>{a.start_time}–{a.end_time}</span>}
                                  </div>
                                  {a.location && <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}><MapPin size={11} style={{ display: 'inline', marginRight: 4 }} />{a.location}</div>}
                                  {a.notes && <div style={{ fontSize: '0.78rem', color: '#d1d5db', marginTop: 2 }}>{a.notes}</div>}
                                </div>
                                <button onClick={() => removeAssignment(a.id)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Нэмэх form */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <select value={newAssignProgramId} onChange={e => applyProgramToForm(e.target.value)}
                              style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: 8, fontSize: '0.82rem', outline: 'none' }}>
                              <option value="">— Дурын цаг (Program сонгоогүй) —</option>
                              {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.start_time}–{p.end_time})</option>)}
                            </select>
                            <select value={newAssignType} onChange={e => setNewAssignType(e.target.value as SessionType)}
                              style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: TYPE_COLORS[newAssignType], padding: '8px 10px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, outline: 'none' }}>
                              {TYPES.map(t => <option key={t} value={t} style={{ color: '#fff' }}>{TYPE_LABELS[t]}</option>)}
                            </select>
                          </div>
                          {newAssignType !== 'rest' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px', borderRadius: 10 }}>
                                <Clock size={14} style={{ color: '#9ca3af' }} />
                                <input type="time" value={newAssignStart} onChange={e => setNewAssignStart(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', fontWeight: 600 }} />
                                <span style={{ color: '#4b5563' }}>—</span>
                                <input type="time" value={newAssignEnd} onChange={e => setNewAssignEnd(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', fontWeight: 600 }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px', borderRadius: 10 }}>
                                <MapPin size={14} style={{ color: '#9ca3af' }} />
                                <input type="text" placeholder="Заалны байршил..." value={newAssignLocation} onChange={e => setNewAssignLocation(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '100%' }} />
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px', borderRadius: 10 }}>
                            <FileText size={14} style={{ color: '#6b7280' }} />
                            <input type="text" placeholder="Нэмэлт тэмдэглэл..." value={newAssignNotes} onChange={e => setNewAssignNotes(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#e5e7eb', fontSize: '0.85rem', outline: 'none', width: '100%' }} />
                          </div>
                          <button onClick={addAssignment} disabled={savingAssignment}
                            style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: 10, fontWeight: 700, border: 'none', cursor: savingAssignment ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Plus size={15} /> {savingAssignment ? 'Нэмж байна...' : 'Энэ өдөрт нэмэх'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ХӨТӨЛБӨРҮҮД ══════════ */}
        {activeTab === 'programs' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 6 }}>Хөтөлбөрүүд</h2>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>Хуваарь оноох үед хурдан сонгож ашиглах цагийн блокуудын каталог. Заавал эдгээрийг ашиглах албагүй — хуваарь оноох үед дурын цаг оруулж болно.</p>
            </div>

            {/* Add / edit form */}
            <div style={{ background: 'rgba(20,27,47,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <ListChecks size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{programForm.id ? 'Хөтөлбөр засах' : 'Шинэ хөтөлбөр нэмэх'}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr auto', gap: 10, alignItems: 'center' }}>
                <input type="text" placeholder="Нэр (ж: 1-р хөтөлбөр)" value={programForm.name} onChange={e => setProgramForm(f => ({ ...f, name: e.target.value }))}
                  style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }} />
                <input type="time" value={programForm.start_time} onChange={e => setProgramForm(f => ({ ...f, start_time: e.target.value }))}
                  style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }} />
                <input type="time" value={programForm.end_time} onChange={e => setProgramForm(f => ({ ...f, end_time: e.target.value }))}
                  style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }} />
                <input type="text" placeholder="Байршил" value={programForm.location} onChange={e => setProgramForm(f => ({ ...f, location: e.target.value }))}
                  style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }} />
                <select value={programForm.type} onChange={e => setProgramForm(f => ({ ...f, type: e.target.value as SessionType }))}
                  style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: TYPE_COLORS[programForm.type], padding: '10px 8px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, outline: 'none' }}>
                  {TYPES.map(t => <option key={t} value={t} style={{ color: '#fff' }}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>

              {/* Долоо хоногийн давтамж — сонгосон бол хуваарь оноох үед
                  "Хурдан оноолт"-оор энэ хөтөлбөрийг сарын тохирох бүх өдөрт нэг дор оноох боломжтой.
                  Өдөр тус бүрийг сонгосны дараа доор нь ГАРАХ цагийн талбараар өөрийн гэсэн цаг өгч болно
                  (анхны утга нь дээрх ерөнхий эхлэх/дуусах цаг). */}
            

              {/* Тодорхой огноонууд — бүтэн сарын хуанлиас шууд дарж сонгоно
                  (7 хоногийн давтамжгүй, зөвхөн тухайн өдрүүдэд л хамаарах бол) */}
              <div style={{ marginTop: 14 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Тодорхой огноонууд 
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => { setProgramDatePickerMonth(new Date()); setShowProgramDatePicker(true) }}
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '9px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <CalendarDays size={14} /> Огноо сонгох
                  </button>
                  {programForm.date_schedule.length > 0 && (
                    <>
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{programForm.date_schedule.length} огноо сонгосон</span>
                      <button type="button" onClick={() => setProgramForm(f => ({ ...f, date_schedule: [] }))}
                        style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>
                        Цэвэрлэх
                      </button>
                    </>
                  )}
                </div>

                {/* Сонгосон огноо бүрийн өөрийн гэсэн цаг */}
                {programForm.date_schedule.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                    {programForm.date_schedule.map(ds => (
                      <div key={ds.date} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 10px' }}>
                        <span style={{ width: 60, fontSize: '0.76rem', fontWeight: 700, color: '#c084fc' }}>{ds.date.slice(5)}</span>
                        <input type="time" value={ds.start_time} onChange={e => updateProgramDateTime(ds.date, 'start_time', e.target.value)}
                          style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '5px 8px', borderRadius: 7, fontSize: '0.78rem', outline: 'none' }} />
                        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>–</span>
                        <input type="time" value={ds.end_time} onChange={e => updateProgramDateTime(ds.date, 'end_time', e.target.value)}
                          style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '5px 8px', borderRadius: 7, fontSize: '0.78rem', outline: 'none' }} />
                        <button type="button" onClick={() => toggleProgramSpecificDate(ds.date)} title="Хасах"
                          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={saveProgram} disabled={savingProgram || !programForm.name.trim()}
                  style={{ background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', opacity: !programForm.name.trim() ? 0.5 : 1 }}>
                  <Save size={15} /> {programForm.id ? 'Шинэчлэх' : 'Нэмэх'}
                </button>
                {programForm.id && (
                  <button onClick={resetProgramForm} style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                    Цуцлах
                  </button>
                )}
              </div>
            </div>

            {/* ── Тодорхой огноо сонгох modal: бүтэн сарын хуанли, огноо дараад сонгоно/цуцална ── */}
            {showProgramDatePicker && (
              <div
                onClick={() => setShowProgramDatePicker(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,18,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ width: '100%', maxWidth: 380, background: 'linear-gradient(180deg, rgba(24,32,54,0.98), rgba(15,20,35,0.98))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <CalendarDays size={17} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>Огноо сонгох</h3>
                    </div>
                    <button onClick={() => setShowProgramDatePicker(false)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#9ca3af', width: 30, height: 30, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.6)', padding: '5px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
                    <button onClick={() => setProgramDatePickerMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', letterSpacing: '0.3px' }}>
                      {monthNames[programDatePickerMonth.getMonth()]} {programDatePickerMonth.getFullYear()}
                    </span>
                    <button onClick={() => setProgramDatePickerMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                    {DAYS_SHORT.map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#6b7280', padding: '2px 0', textTransform: 'uppercase' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {buildCalendarCells(programDatePickerMonth).map((cell, idx) => {
                      const dateStr = ymd(cell.date)
                      const isToday = dateStr === todayStr
                      const isSelected = programForm.date_schedule.some(d => d.date === dateStr)
                      return (
                        <button key={idx} type="button"
                          onClick={() => cell.inMonth && toggleProgramSpecificDate(dateStr)}
                          disabled={!cell.inMonth}
                          style={{
                            aspectRatio: '1', minHeight: 36,
                            background: isSelected ? '#3b82f6' : isToday ? 'rgba(59,130,246,0.08)' : 'rgba(10,14,26,0.3)',
                            border: isSelected ? '1px solid #3b82f6' : isToday ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.04)',
                            borderRadius: 8, padding: '2px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: cell.inMonth ? 'pointer' : 'default', opacity: cell.inMonth ? 1 : 0.3, transition: 'all .12s'
                          }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: isSelected || isToday ? 800 : 600, color: isSelected ? '#fff' : isToday ? '#60a5fa' : cell.inMonth ? '#e5e7eb' : '#4b5563' }}>{cell.date.getDate()}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <span style={{ flex: 1, fontSize: '0.8rem', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                      {programForm.date_schedule.length > 0 ? `${programForm.date_schedule.length} огноо сонгосон` : 'Огноо сонгоогүй байна'}
                    </span>
                    <button onClick={() => setShowProgramDatePicker(false)}
                      style={{ background: '#3b82f6', color: '#fff', padding: '9px 20px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                      Дуусгах
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {programs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: 'rgba(20,27,47,0.3)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.08)' }}>
                  Хөтөлбөр байхгүй байна. Дээрх form-оор нэмнэ үү.
                </div>
              )}
              {programs.map(p => {
                const isExpanded = selectedProgramId === p.id
                return (
                <div key={p.id} style={{ background: 'rgba(20,27,47,0.5)', border: isExpanded ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 14, opacity: p.active ? 1 : 0.5, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', gap: 12 }}>
                    <div onClick={() => viewProgramUsers(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                      <div style={{ width: 4, height: 34, borderRadius: 4, background: TYPE_COLORS[p.type], flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {p.name}
                          <span style={{ color: isExpanded ? '#60a5fa' : '#4b5563', fontSize: '0.7rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▼</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af', display: 'flex', gap: 10, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ color: TYPE_COLORS[p.type], fontWeight: 700 }}>{TYPE_LABELS[p.type]}</span>
                          <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{p.start_time}–{p.end_time}</span>
                          {p.location && <span><MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />{p.location}</span>}
                          {p.day_schedule && p.day_schedule.length > 0 && (
                            <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                              {p.day_schedule.map(ds => (
                                <span key={ds.day} title={`${ds.start_time}–${ds.end_time}`} style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '1px 6px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {DAYS_SHORT[jsDayToDayIdx(ds.day)]} {ds.start_time}
                                </span>
                              ))}
                            </span>
                          )}
                          {p.date_schedule && p.date_schedule.length > 0 && (
                            <span title={p.date_schedule.map(ds => `${ds.date} ${ds.start_time}–${ds.end_time}`).join(', ')} style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', padding: '1px 6px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <CalendarDays size={10} /> {p.date_schedule.length} огноо
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => toggleProgramActive(p)}
                        style={{ background: p.active ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${p.active ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, color: p.active ? '#10b981' : '#9ca3af', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        {p.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </button>
                      <button onClick={() => editProgram(p)} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Pencil size={13} /></button>
                      <button onClick={() => deleteProgram(p.id, p.name)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {/* Тухайн хөтөлбөрт хамрагдаж буй тоглогчид */}
                  {isExpanded && (
                    <div style={{ padding: '4px 18px 16px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Шинэ: олон хэрэглэгчийг НЭГ dropdown label дотроос сонгож энэ хөтөлбөрт оноох */}
                      <div style={{ marginTop: 10, marginBottom: 14, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd', marginBottom: 8 }}>
                          + Хэрэглэгч сонгож энэ хөтөлбөрт оноох
                        </div>
                        <div style={{ position: 'relative' }}>
                          <button type="button" onClick={() => setShowBulkAssignPicker(v => !v)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: bulkAssignUserIds.size > 0 ? '#fff' : '#9ca3af', padding: '9px 12px', borderRadius: 10, fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' }}>
                            <span>{bulkAssignUserIds.size > 0 ? `${bulkAssignUserIds.size} хэрэглэгч сонгосон` : '— Хэрэглэгч сонгох —'}</span>
                            <span style={{ color: '#6b7280', fontSize: '0.7rem', transform: showBulkAssignPicker ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▼</span>
                          </button>

                          {showBulkAssignPicker && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#0f172a', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.45)', zIndex: 20, padding: 10 }}>
                              <input type="text" placeholder="Хэрэглэгч хайх..." value={bulkAssignSearch} onChange={e => setBulkAssignSearch(e.target.value)}
                                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '7px 10px', borderRadius: 8, fontSize: '0.8rem', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {users.filter(u => u.full_name?.toLowerCase().includes(bulkAssignSearch.toLowerCase())).map(u => {
                                  const checked = bulkAssignUserIds.has(u.id)
                                  return (
                                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', background: checked ? 'rgba(59,130,246,0.12)' : 'transparent' }}>
                                      <input type="checkbox" checked={checked}
                                        onChange={() => setBulkAssignUserIds(prev => {
                                          const next = new Set(prev)
                                          if (next.has(u.id)) next.delete(u.id); else next.add(u.id)
                                          return next
                                        })}
                                        style={{ accentColor: '#3b82f6', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }} />
                                      <span style={{ color: checked ? '#fff' : '#e5e7eb', fontSize: '0.83rem', fontWeight: checked ? 700 : 500 }}>{u.full_name}</span>
                                    </label>
                                  )
                                })}
                                {users.filter(u => u.full_name?.toLowerCase().includes(bulkAssignSearch.toLowerCase())).length === 0 && (
                                  <span style={{ color: '#6b7280', fontSize: '0.78rem', padding: '6px 8px' }}>Олдсонгүй.</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                <button type="button" onClick={() => setShowBulkAssignPicker(false)}
                                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af', padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                  Хаах
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <button onClick={() => bulkAssignProgramToUsers(p, Array.from(bulkAssignUserIds))}
                          disabled={bulkAssignUserIds.size === 0 || bulkAssigningProgram}
                          style={{ background: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: 9, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', opacity: bulkAssignUserIds.size === 0 ? 0.5 : 1, marginTop: 10 }}>
                          {bulkAssigningProgram ? 'Оноож байна...' : `Сонгосон${bulkAssignUserIds.size > 0 ? ` (${bulkAssignUserIds.size})` : ''} хэрэглэгчид оноох`}
                        </button>
                      </div>

                      {programAssignmentsLoading ? (
                        <p style={{ color: '#6b7280', fontSize: '0.82rem', padding: '10px 0' }}>Уншиж байна...</p>
                      ) : programAssignments.length === 0 ? (
                        <p style={{ color: '#6b7280', fontSize: '0.82rem', padding: '10px 0' }}>Энэ хөтөлбөрт одоогоор хэн ч оноогдоогүй байна.</p>
                      ) : (
                        (() => {
                          // МУУХАЙ БАГ ЗАСВАР: өмнө нь key={r.name + r.email} ашигладаг байсан тул
                          // ижил нэртэй (эсвэл хоёулаа email хоосон) хэрэглэгчид байвал React
                          // key мөргөлдөж, зөвхөн НЭГ мөр л харагддаг байсан (өгөгдөл дата дээр
                          // зөв хадгалагдсан ч UI дээр "алга болдог"). id-г key болгож засав.
                          const byUser: Record<string, { id: string; name: string; email: string; dates: string[] }> = {}
                          programAssignments.forEach(a => {
                            const u = users.find(usr => usr.id === a.user_id)
                            if (!byUser[a.user_id]) byUser[a.user_id] = { id: a.user_id, name: u?.full_name || 'Тодорхойгүй', email: u?.email || '', dates: [] }
                            byUser[a.user_id].dates.push(a.date)
                          })
                          const rows = Object.values(byUser).sort((a, b) => a.name.localeCompare(b.name))
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {rows.length} тоглогч · нийт {programAssignments.length} удаа оноогдсон
                              </div>
                              {rows.map(r => (
                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', gap: 10, flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <User size={13} style={{ color: '#6b7280', flexShrink: 0 }} />
                                    <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{r.name}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {r.dates.slice(0, 8).map(d => (
                                      <span key={d} style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>{displayDate(d)}</span>
                                    ))}
                                    {r.dates.length > 8 && <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>+{r.dates.length - 8}</span>}
                                    <button type="button" onClick={() => removeUserFromProgram(p.id, r.id, r.name, r.dates.length)} title="Энэ хөтөлбөрөөс хасах"
                                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '4px 6px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 4 }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()
                      )}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════ НИЙТ CALENDAR VIEW ══════════ */}
        {activeTab === 'calendar' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: 0 }}>Нийт хуваарь</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: 4 }}>Сараар харах, өдөр дарж дэлгэрэнгүй харна</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => navigate('/report')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                  📊 Тайлан харах
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => { setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setCalendarSelectedDate(null) }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
                  <span style={{ fontWeight: 700, color: '#fff', minWidth: 140, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
                    {monthNames[calMonthIdx]} {calYear}
                  </span>
                  <button onClick={() => { setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setCalendarSelectedDate(null) }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><ChevronRight size={18} /></button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: calendarSelectedDate ? '1fr 340px' : '1fr', gap: 20, alignItems: 'start' }}>

              {/* Calendar */}
              <div style={{ background: 'rgba(20,27,47,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
                  {DAYS_SHORT.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', padding: '6px 0', textTransform: 'uppercase' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {calendarCells.map((cell, idx) => {
                    const dateStr = ymd(cell.date)
                    const isToday = dateStr === todayStr
                    const isSelected = calendarSelectedDate === dateStr
                    const att = monthAttendance[dateStr]
                    const scheduledCount = (monthAssignments[dateStr] || []).length
                    const markedCount = att ? att.present + att.absent : 0
                    const attState: 'none' | 'scheduled' | 'partial' | 'full' =
                      scheduledCount === 0 ? 'none' : markedCount === 0 ? 'scheduled' : markedCount < scheduledCount ? 'partial' : 'full'
                    const dotColor = attState === 'full' ? '#10b981' : attState === 'partial' ? '#f59e0b' : attState === 'scheduled' ? '#3b82f6' : null
                    const dotTitle = attState === 'full' ? `${scheduledCount} хуваарьтай — ирц бүрэн бүртгэгдсэн (✓${att?.present || 0} ✗${att?.absent || 0})`
                      : attState === 'partial' ? `${scheduledCount} хуваарьтай — ирц дутуу бүртгэгдсэн (${markedCount}/${scheduledCount})`
                      : attState === 'scheduled' ? `${scheduledCount} хуваарьтай — ирц бүртгээгүй`
                      : undefined

                    return (
                      <button key={idx}
                        onClick={() => cell.inMonth && setCalendarSelectedDate(isSelected ? null : dateStr)}
                        disabled={!cell.inMonth}
                        title={dotTitle}
                        style={{
                          position: 'relative',
                          aspectRatio: '1', minHeight: 64,
                          background: isSelected ? 'rgba(59,130,246,0.18)' : isToday ? 'rgba(59,130,246,0.08)' : 'rgba(10,14,26,0.3)',
                          border: isSelected ? '2px solid #3b82f6' : isToday ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.04)',
                          borderRadius: 10, padding: '6px 4px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                          cursor: cell.inMonth ? 'pointer' : 'default',
                          opacity: cell.inMonth ? 1 : 0.3,
                          transition: 'all .15s'
                        }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#60a5fa' : cell.inMonth ? '#e5e7eb' : '#4b5563' }}>
                          {cell.date.getDate()}
                        </span>
                        {cell.inMonth && dotColor && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
                        )}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', fontSize: '0.78rem', color: '#9ca3af' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> хуваарьтай, ирц бүртгээгүй
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> ирц дутуу бүртгэгдсэн
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> ирц бүрэн бүртгэгдсэн
                  </span>
                  <span style={{ color: '#6b7280' }}>(өдрийг дарж дэлгэрэнгүйг харна)</span>
                </div>
              </div>

              {/* Selected date detail panel */}
              {calendarSelectedDate && (
                <div style={{ background: 'rgba(20,27,47,0.5)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 16, padding: 18, position: 'sticky', top: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                      {displayDate(calendarSelectedDate!)}
                    </h3>
                    <button onClick={() => setCalendarSelectedDate(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={16} /></button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                    {selectedDateAssignments.length === 0 ? (
                      <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>Энэ өдөр хуваарьтай тоглогч байхгүй.</p>
                    ) : selectedDateAssignments.map(a => {
                      const u = users.find(usr => usr.id === a.user_id)
                      const attStatus = monthAttendance[calendarSelectedDate!]?.userMap[a.user_id]
                      return (
                        <div key={a.id} style={{ background: attStatus === 'present' ? 'rgba(16,185,129,0.06)' : attStatus === 'absent' ? 'rgba(239,68,68,0.06)' : 'rgba(10,14,26,0.4)', border: `1px solid ${attStatus === 'present' ? 'rgba(16,185,129,0.2)' : attStatus === 'absent' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{u?.full_name || 'Тодорхойгүй'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                                background: attStatus === 'present' ? 'rgba(16,185,129,0.15)' : attStatus === 'absent' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                                color: attStatus === 'present' ? '#10b981' : attStatus === 'absent' ? '#ef4444' : '#9ca3af' }}>
                                {attStatus === 'present' ? '✓ Ирсэн' : attStatus === 'absent' ? '✗ Ирээгүй' : '? Тэмдэглээгүй'}
                              </span>
                              <button type="button" onClick={() => { if (window.confirm(`${u?.full_name || 'Энэ'} хэрэглэгчийн энэ өдрийн хуваарийг устгах уу?`)) removeAssignment(a.id) }} title="Энэ хуваарийг устгах"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '4px 6px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div style={{ borderLeft: `3px solid ${TYPE_COLORS[a.type]}`, paddingLeft: 8 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: TYPE_COLORS[a.type] }}>{TYPE_LABELS[a.type]}</span>
                            {a.type !== 'rest' && <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: 6 }}>{a.start_time}–{a.end_time}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => { setAttendanceDate(calendarSelectedDate); setActiveTab('attendance') }}
                    style={{ marginTop: 14, width: '100%', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ClipboardCheck size={15} /> Энэ өдрийн ирц бүртгэх
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ИРЦ БҮРТГЭЛ ══════════ */}
        {activeTab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: 0, fontWeight: 700, letterSpacing: '-0.5px', color: '#fff' }}>Ирц бүртгэл</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.88rem', marginTop: 4 }}>Хуанлиас өдөр сонгоод тоглогчдын ирцийг хурдан горимоор тэмдэглэнэ. Зөвхөн "Ирсэн" гэж тэмдэглэсэн өдөр л сарын лимит рүү тооцогдоно.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
                <button onClick={() => setAttMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '8px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                  <ChevronLeft size={18} />
                </button>
                <span style={{ fontWeight: 700, color: '#fff', minWidth: 130, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '0.95rem', letterSpacing: '0.3px' }}>
                  {monthNames[attMonthIdx]} {attYear}
                </span>
                <button onClick={() => setAttMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '8px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: attendanceDate ? '1fr 380px' : '1fr', gap: 24, alignItems: 'start' }}>
              {/* Calendar Card */}
              <div style={{ background: 'rgba(17, 24, 39, 0.45)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20, backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
                  {DAYS_SHORT.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {d}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {attCells.map((cell, idx) => {
                    const dateStr = ymd(cell.date)
                    const isToday = dateStr === todayStr
                    const isSelected = attendanceDate === dateStr
                    const att = attMonthData[dateStr]
                    const isFuture = cell.date > new Date()

                    return (
                      <button key={idx}
                        onClick={() => { if (cell.inMonth) setAttendanceDate(dateStr) }}
                        disabled={!cell.inMonth || isFuture}
                        style={{
                          aspectRatio: '1',
                          minHeight: 74,
                          background: isSelected ? 'rgba(59, 130, 246, 0.16)' : isToday ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '2px solid #3b82f6' : isToday ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.04)',
                          borderRadius: 14,
                          padding: '10px 6px 8px 6px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                          cursor: cell.inMonth && !isFuture ? 'pointer' : 'default',
                          opacity: cell.inMonth ? (isFuture ? 0.3 : 1) : 0.12,
                          transform: isSelected ? 'scale(0.98)' : 'none',
                          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
                        }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: isToday || isSelected ? 800 : 500, color: isToday ? '#60a5fa' : isSelected ? '#60a5fa' : cell.inMonth ? '#f3f4f6' : '#4b5563', lineHeight: 1 }}>
                          {cell.date.getDate()}
                        </span>
                        {cell.inMonth && !isFuture && att && (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', width: '100%' }}>
                            {att.present > 0 && (
                              <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '1px 5px', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                {att.present}
                              </span>
                            )}
                            {att.absent > 0 && (
                              <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 700, background: 'rgba(239, 68, 68, 0.12)', padding: '1px 5px', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                {att.absent}
                              </span>
                            )}
                          </div>
                        )}
                        {cell.inMonth && !isFuture && !att && (
                          <div style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', marginBottom: 4 }} />
                        )}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#6b7280' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span>Ногоон тоо = Ирсэн тоглогч</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span>Улаан тоо = Ирээгүй тоглогч</span>
                  </div>
                </div>
              </div>

              {/* Right: selected date attendance form */}
              {attendanceDate && (
                <div style={{ background: 'rgba(17, 24, 39, 0.5)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 20, padding: 20, backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>
                      {displayDate(attendanceDate)} — Ирц бүртгэл
                    </h3>
                    <div style={{ display: 'flex', gap: 6, fontSize: '0.78rem', fontWeight: 700 }}>
                      <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                        ✓ {visibleAttendanceUsers.filter(u => attendanceMap[u.id] === 'present').length}
                      </span>
                      <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                        ✗ {visibleAttendanceUsers.filter(u => attendanceMap[u.id] === 'absent').length}
                      </span>
                      <span style={{ color: '#9ca3af', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        ? {visibleAttendanceUsers.filter(u => !attendanceMap[u.id]).length}
                      </span>
                    </div>
                  </div>

                  {/* Хөтөлбөрөөр шүүх — сонговол зөвхөн тэр хөтөлбөрт тухайн
                      өдөр оноогдсон тоглогчид л жагсаалтад үлдэнэ */}
                  <div style={{ marginBottom: 10 }}>
                    <select value={attendanceProgramFilter} onChange={e => setAttendanceProgramFilter(e.target.value)}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: attendanceProgramFilter ? '#60a5fa' : '#9ca3af', padding: '9px 12px', borderRadius: 10, fontSize: '0.83rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">Бүх тоглогч</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>🏐 {p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                    <Search size={14} style={{ color: '#6b7280' }} />
                    <input type="text" placeholder="Тоглогч нэрээр хайх..." value={attendanceSearch} onChange={e => setAttendanceSearch(e.target.value)}
                      style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '100%' }} />
                  </div>

                  {attendanceProgramFilter && visibleAttendanceUsers.length === 0 && (
                    <p style={{ color: '#6b7280', fontSize: '0.82rem', padding: '8px 0 14px 0', textAlign: 'center' }}>
                      Энэ хөтөлбөрт одоогоор хэн ч оноогдоогүй байна. (Schedule/Programs-с оноосон эсэхээ шалгаарай.)
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto', paddingRight: 4 }}>
                    {visibleAttendanceUsers.map(u => {
                      const status = attendanceMap[u.id]
                      const handleToggleAttendance = (targetStatus: 'present' | 'absent') => {
                        if (status === targetStatus) markAttendance(u.id, 'unmarked')
                        else markAttendance(u.id, targetStatus)
                      }
                      return (
                        <div key={u.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: status === 'present' ? 'rgba(16,185,129,0.04)' : status === 'absent' ? 'rgba(239,68,68,0.04)' : 'rgba(30, 41, 59, 0.25)',
                          border: `1px solid ${status === 'present' ? 'rgba(16,185,129,0.22)' : status === 'absent' ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.04)'}`,
                          borderRadius: 14, padding: '10px 12px', gap: 12, transition: 'all 0.2s ease'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: status === 'present' ? 'rgba(16,185,129,0.12)' : status === 'absent' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `1px solid ${status === 'present' ? 'rgba(16,185,129,0.3)' : status === 'absent' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`
                            }}>
                              {status === 'present' ? <CheckCircle2 size={15} style={{ color: '#10b981' }} /> :
                               status === 'absent' ? <XCircle size={15} style={{ color: '#ef4444' }} /> :
                               <User size={15} style={{ color: '#9ca3af' }} />}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, color: status === 'present' ? '#10b981' : status === 'absent' ? '#ef4444' : '#fff', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {u.full_name}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => handleToggleAttendance('present')} disabled={attendanceSaving === u.id}
                              style={{ background: status === 'present' ? '#10b981' : 'rgba(16,185,129,0.05)', border: `1px solid ${status === 'present' ? '#10b981' : 'rgba(16,185,129,0.2)'}`, color: status === 'present' ? '#fff' : '#10b981', padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
                              ✓
                            </button>
                            <button onClick={() => handleToggleAttendance('absent')} disabled={attendanceSaving === u.id}
                              style={{ background: status === 'absent' ? '#ef4444' : 'rgba(239,68,68,0.05)', border: `1px solid ${status === 'absent' ? '#ef4444' : 'rgba(239,68,68,0.2)'}`, color: status === 'absent' ? '#fff' : '#ef4444', padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
                              ✗
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ХЭРЭГЛЭГЧИЙН ЭРХ ══════════ */}
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 6 }}>Хэрэглэгчийн эрх</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>Role өөрчлөх болон шинэ хэрэглэгч үүсгэх.</p>
              </div>
              <button onClick={() => { setInviteResult(null); setShowCreateUserModal(true) }}
                style={{ background: '#f97316', color: '#fff', padding: '11px 20px', borderRadius: 12, border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}>
                <Plus size={16} /> Шинэ хэрэглэгч
              </button>
            </div>

            {/* ── Хуучин өгөгдөл цэвэрлэх (Supabase Free 500MB хязгаараас сэргийлэх) —
                 үндсэн UI-г бөглөрүүлэхгүйн тулд эхэндээ хаалттай, жижиг disclosure
                 хэлбэрээр нуугдмал байна. ── */}
            {(() => {
              const dbPct = dbSizeBytes !== null ? Math.min(100, (dbSizeBytes / DB_LIMIT_BYTES) * 100) : null
              const dbMb = dbSizeBytes !== null ? dbSizeBytes / (1024 * 1024) : null
              const dbColor = dbPct === null ? '#6b7280' : dbPct >= 80 ? '#ef4444' : dbPct >= 50 ? '#f59e0b' : '#10b981'
              return (
                <div style={{ marginBottom: 24 }}>
                  <button type="button" onClick={() => setShowCleanupPanel(v => !v)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', transform: showCleanupPanel ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'inline-block' }}>▶</span>
                    <span>Санах хэмжээ</span>
                    {dbMb !== null && dbPct !== null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 60, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', display: 'inline-block' }}>
                          <span style={{ display: 'block', width: `${dbPct}%`, height: '100%', background: dbColor }} />
                        </span>
                        <span style={{ color: dbColor, fontWeight: 700 }}>{dbMb.toFixed(0)} MB / 500 MB ({dbPct.toFixed(0)}%)</span>
                      </span>
                    )}
                  </button>
                  {showCleanupPanel && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {dbMb !== null && dbPct !== null && (
                        <div>
                          <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${dbPct}%`, height: '100%', background: dbColor }} />
                          </div>
                          <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: dbColor, fontWeight: 700 }}>
                            {dbMb.toFixed(1)} MB / 500 MB ашиглагдсан ({dbPct.toFixed(1)}%)
                          </p>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af', maxWidth: 420 }}>2 сараас хуучирсан хуваарь болон ирцийн бүртгэлийг бүрмөсөн устгаж, database-ийн эзлэхүүнийг чөлөөлнө.</p>
                        <div style={{ position: 'relative' }}>
                          <button type="button" onClick={() => setShowCleanupMenu(v => !v)} title="Үйлдэл"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, letterSpacing: 1 }}>
                            ⋯
                          </button>
                          {showCleanupMenu && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.45)', zIndex: 20, minWidth: 200, overflow: 'hidden' }}>
                              <button onClick={() => { setShowCleanupMenu(false); cleanupOldData(2) }} disabled={cleanupLoading}
                                style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', padding: '10px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: cleanupLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: cleanupLoading ? 0.6 : 1, textAlign: 'left' }}>
                                <Trash2 size={13} /> {cleanupLoading ? 'Шалгаж байна...' : '2 сараас хуучныг устгах'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ── Шинэ хэрэглэгч үүсгэх modal ── */}
            {showCreateUserModal && (
              <div
                onClick={() => !inviteSending && setShowCreateUserModal(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,18,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
                <div onClick={e => e.stopPropagation()}
                  style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(180deg, rgba(24,32,54,0.98), rgba(15,20,35,0.98))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(249,115,22,0.12)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(249,115,22,0.2)' }}>
                        <Mail size={19} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Шинэ хэрэглэгч үүсгэх</h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>Email илгээхгүй — нууц үгийг өөрөө дамжуулна</p>
                      </div>
                    </div>
                    <button onClick={() => setShowCreateUserModal(false)} disabled={inviteSending}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#9ca3af', width: 32, height: 32, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Нэр</label>
                      <input type="text" placeholder="Баатар Дорж" value={inviteName} onChange={e => setInviteName(e.target.value)}
                        style={{ width: '100%', background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '11px 14px', borderRadius: 10, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>И-мэйл хаяг</label>
                      <input type="email" placeholder="email@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                        style={{ width: '100%', background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '11px 14px', borderRadius: 10, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Нууц үг</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" placeholder="6+ тэмдэгт" value={invitePassword} onChange={e => setInvitePassword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendInvite()}
                          style={{ flex: 1, minWidth: 0, background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '11px 14px', borderRadius: 10, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                        <button type="button" onClick={generateInvitePassword} title="Санамсаргүй нууц үг үүсгэх"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb', padding: '0 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', flexShrink: 0 }}>
                          🎲
                        </button>
                      </div>
                    </div>

                    {inviteResult && (
                      <div style={{ padding: '10px 14px', borderRadius: 10, background: inviteResult.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${inviteResult.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: inviteResult.type === 'success' ? '#10b981' : '#ef4444', fontSize: '0.83rem', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
                        {inviteResult.type === 'success' ? <Check size={15} style={{ flexShrink: 0, marginTop: 2 }} /> : <X size={15} style={{ flexShrink: 0, marginTop: 2 }} />}
                        <span>{inviteResult.msg}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button onClick={() => setShowCreateUserModal(false)} disabled={inviteSending}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)', padding: '11px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                        Хаах
                      </button>
                      <button onClick={sendInvite} disabled={inviteSending || !inviteEmail.trim() || !invitePassword.trim()}
                        style={{ flex: 2, background: '#f97316', color: '#fff', padding: '11px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.88rem', opacity: (!inviteEmail.trim() || !invitePassword.trim()) ? 0.5 : 1 }}>
                        <Send size={15} />{inviteSending ? 'Үүсгэж байна...' : 'Хэрэглэгч үүсгэх'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px', marginBottom: 16, maxWidth: 400 }}>
              <Search size={15} style={{ color: '#6b7280' }} />
              <input type="text" placeholder="Хэрэглэгч хайх..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none', width: '100%' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredAllUsers.map(u => {
                const roleColor = u.role === 'admin' ? '#f97316' : u.role === 'coach' ? '#a855f7' : '#6b7280'
                const isExpanded = expandedUserId === u.id
                return (
                <div key={u.id} style={{ background: 'rgba(20,27,47,0.5)', border: isExpanded ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'visible', position: 'relative', zIndex: openUserMenuId === u.id ? 30 : 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', flexWrap: 'wrap', gap: 12 }}>
                    <div onClick={() => toggleExpandUser(u)} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: u.role === 'admin' ? 'rgba(249,115,22,0.15)' : u.role === 'coach' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${roleColor}66`, flexShrink: 0 }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : u.role === 'admin' ? <ShieldCheck size={18} style={{ color: '#f97316' }} /> : <User size={18} style={{ color: roleColor }} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {u.full_name}
                          <span style={{ color: isExpanded ? '#60a5fa' : '#4b5563', fontSize: '0.65rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▼</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{u.email}{u.position && <span style={{ color: roleColor }}> · {u.position}</span>}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <select value={u.role || 'user'} disabled={roleUpdating === u.id} onChange={(e) => updateUserRole(u.id, e.target.value as 'admin' | 'user' | 'coach')}
                          style={{
                            background: 'rgba(5,8,18,0.7)', border: `1px solid ${roleColor}66`,
                            color: roleColor === '#6b7280' ? '#e5e7eb' : roleColor, padding: '8px 32px 8px 14px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, outline: 'none', cursor: 'pointer',
                            WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', minWidth: 120, transition: 'all 0.2s'
                          }}>
                          <option value="user" style={{ background: '#0a0e1a', color: '#fff' }}>👤 User</option>
                          <option value="coach" style={{ background: '#0a0e1a', color: '#a855f7' }}>🏐 Coach</option>
                          <option value="admin" style={{ background: '#0a0e1a', color: '#f97316' }}>⚡ Admin</option>
                        </select>
                        <span style={{ position: 'absolute', right: 12, color: roleColor, pointerEvents: 'none', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}>
                          {roleUpdating === u.id ? '...' : '▼'}
                        </span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <button type="button" onClick={() => setOpenUserMenuId(openUserMenuId === u.id ? null : u.id)} title="Үйлдэл"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, letterSpacing: 1 }}>
                          ⋯
                        </button>
                        {openUserMenuId === u.id && (
                          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.45)', zIndex: 20, minWidth: 190, overflow: 'hidden' }}>
                            <button onClick={() => { setOpenUserMenuId(null); toggleExpandUser(u) }}
                              style={{ width: '100%', background: 'none', border: 'none', color: '#60a5fa', padding: '10px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                              <Pencil size={13} /> Профайл засах
                            </button>
                            <button onClick={() => { setOpenUserMenuId(null); deleteUser(u.id, u.full_name) }} disabled={deletingUserId === u.id}
                              style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', padding: '10px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: deletingUserId === u.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: deletingUserId === u.id ? 0.5 : 1, textAlign: 'left', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <Trash2 size={13} /> {deletingUserId === u.id ? 'Устгаж байна...' : 'Устгах'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Профайл дэлгэрэнгүй — багийн хуудсан дээр харагдах байрлал/дугаар/зураг */}
                  {isExpanded && (
                    <div style={{ padding: '4px 20px 18px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Зураг — компьютер/утаснаас (камер эсвэл галерей) шууд сонгож upload хийнэ */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 12 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {profileDraft.avatar_url ? (
                            <img src={profileDraft.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <User size={24} style={{ color: '#6b7280' }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '7px 14px', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, cursor: avatarUploading === u.id ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content', opacity: avatarUploading === u.id ? 0.6 : 1 }}>
                            <ImageIcon size={13} />
                            {avatarUploading === u.id ? 'Ачааллаж байна...' : 'Зураг оруулах'}
                            <input type="file" accept="image/*" disabled={avatarUploading === u.id} style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(u.id, f); e.target.value = '' }} />
                          </label>
                          {profileDraft.avatar_url && (
                            <button type="button" onClick={() => setProfileDraft(d => ({ ...d, avatar_url: '' }))}
                              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0, width: 'fit-content' }}>
                              Зураг хасах
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 10, alignItems: 'center' }}>
                        <input type="text" placeholder="Байрлал (ж: Setter, эсвэл Ерөнхий дасгалжуулагч)" value={profileDraft.position}
                          onChange={e => setProfileDraft(d => ({ ...d, position: e.target.value }))}
                          style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '9px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }} />
                        <input type="number" placeholder="Дугаар" value={profileDraft.jersey_number}
                          onChange={e => setProfileDraft(d => ({ ...d, jersey_number: e.target.value }))}
                          style={{ background: 'rgba(5,8,18,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '9px 12px', borderRadius: 10, fontSize: '0.85rem', outline: 'none' }} />
                        <button onClick={() => saveUserProfile(u.id, profileDraft)} disabled={profileSaving === u.id}
                          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                          <Save size={13} /> {profileSaving === u.id ? '...' : 'Хадгалах'}
                        </button>
                      </div>
                      <p style={{ margin: '10px 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                        Дасгалжуулагчаар харуулахын тулд дээрх role-г "🏐 Coach" болгож, байрлал талбарт цол (ж: "Ерөнхий Дасгалжуулагч") бичнэ үү — Багийн хуудсан дээр шууд харагдана.
                      </p>
                    </div>
                  )}
                </div>
                )
              })}
              {filteredAllUsers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Хэрэглэгч олдсонгүй</div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ САНАЛ ХҮСЭЛТ ══════════ */}
        {activeTab === 'contact' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 6 }}>Санал хүсэлт</h2>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>Вэбсайтын "Холбоо барих" хуудаснаас ирсэн зурвасууд.</p>
            </div>

            {contactLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Ачааллаж байна...</div>
            ) : contactMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Одоогоор зурвас алга.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contactMessages.map(m => (
                  <div key={m.id}
                    onClick={() => !m.is_read && markContactRead(m.id, true)}
                    style={{
                      background: m.is_read ? 'rgba(20,27,47,0.4)' : 'rgba(59,130,246,0.06)',
                      border: m.is_read ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(59,130,246,0.25)',
                      borderRadius: 14, padding: '14px 18px', cursor: !m.is_read ? 'pointer' : 'default'
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {!m.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>{m.name}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{m.email}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{new Date(m.created_at).toLocaleString('mn-MN')}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); markContactRead(m.id, !m.is_read) }}
                          title={m.is_read ? 'Уншаагүй болгох' : 'Уншсан болгох'}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', padding: '5px 9px', borderRadius: 8, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                          {m.is_read ? '✓ Уншсан' : 'Уншаагүй'}
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); deleteContactMessage(m.id) }}
                          title="Устгах"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 8px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: '10px 0 0 0', color: '#d1d5db', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>{m.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
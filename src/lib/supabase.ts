import { createClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://oqwjfjxubirpkwijntmk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xd2pmanh1YmlycGt3aWpudG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzgyNDgsImV4cCI6MjA5ODI1NDI0OH0.lGfQ9YI7xgsl01N0v0RhiNQm1aUgcNQYa-PIVkXzUb0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'user' | 'admin' | 'coach'
export type SessionType = 'practice' | 'match' | 'training' | 'rest'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  position?: string
  jersey_number?: number
  avatar_url?: string
  /** Сард хэдэн удаа ирэх лимит (жишээ нь 15 удаа). Прогресс % үүн дээр тооцогдоно. */
  monthly_visit_limit?: number
  /** @deprecated Хуучин цагаар тооцдог байсан лимит. monthly_visit_limit-ээр солигдсон. */
  monthly_hours_limit?: number
  created_at: string
}

/** Админын урьдчилан тохируулдаг цагийн блокуудын каталог (ж: 14:00-16:00). */
export interface Program {
  id: string
  name: string
  start_time: string
  end_time: string
  location: string
  type: SessionType
  active: boolean
  created_at: string
}

/**
 * Тухайн тоглогчид тухайн ОГНОО дээр (7 хоногийн ямар ч өдөр) оноосон
 * бэлтгэлийн цаг. Долоо хоног бүр давтагддаг байсан хуучин
 * ScheduleSlot/UserSchedule-г орлоно.
 */
export interface SessionAssignment {
  id: string
  user_id: string
  date: string // 'YYYY-MM-DD'
  program_id: string | null
  start_time: string
  end_time: string
  location: string
  type: SessionType
  notes?: string
  created_by: string
  created_at: string
}

export interface AttendanceRecord {
  id: string
  user_id: string
  date: string
  status: 'present' | 'absent'
  created_at: string
}

/** @deprecated session_assignments-ээр солигдсон. Хуучин өгөгдөл унших зорилгоор л үлдсэн. */
export interface ScheduleSlot {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  location: string
  type: SessionType
  notes?: string
}

/** @deprecated session_assignments-ээр солигдсон. */
export interface UserSchedule {
  id: string
  user_id: string
  week_start: string
  schedule_slots: ScheduleSlot[]
  created_by: string
  created_at: string
}

export interface TeamMember {
  id: string
  full_name: string
  position: string
  jersey_number: number
  role: UserRole
  avatar_url?: string
}
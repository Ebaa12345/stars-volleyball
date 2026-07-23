import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Одоогийн session-ий хэрэглэгчийн id-г байнга заана. Admin шинэ хэрэглэгч
  // үүсгэх үед (Admin.tsx sendInvite) session түр шинэ хэрэглэгч рүү сольж,
  // дараа нь буцаадаг тул хоёр fetchProfile() зэрэг явагдаж болзошгүй.
  // Хожуу гарч ирсэн (stale) хариу currentUserIdRef-тэй таарахгүй бол
  // profile state-г бичихгүй — эс тэгвээс admin-ийн profile шинэ
  // хэрэглэгчийнхээр дарагдаж, isAdmin гэнэт false болж болзошгүй байсан.
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      currentUserIdRef.current = session?.user?.id ?? null
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      currentUserIdRef.current = session?.user?.id ?? null
      if (session?.user) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (userId !== currentUserIdRef.current) return // stale хариу — үл тооно
      if (!error && data) setProfile(data as Profile)
    } catch (e) {
      console.error('Profile fetch error:', e)
    } finally {
      if (userId === currentUserIdRef.current) setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })
    // profiles мөр нь handle_new_user trigger-ээр автоматаар үүснэ (schema-г үз)
    // Энд дахин insert хийх шаардлагагүй — давхар бичигдэж 500 алдаа гаргадаг байсан.
    // Trigger хэзээ гүйцэтгэгдэхийг баттай мэдэхгүй тул (сервер удаашрах үед
    // тогтмол 500мс хүрэлцэхгүй байж болно) мөр гарч ирэх хүртэл богино
    // зайтайгаар (нийт ~2с) дахин шалгаад, олдвол л нэрийг шинэчилнэ.
    if (!error && data.user && fullName) {
      const userId = data.user.id
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 400))
        const { data: existing } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
        if (existing) {
          const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId)
          if (updateError) console.error('Бүртгүүлсний дараа нэр хадгалахад алдаа гарлаа:', updateError)
          break
        }
      }
    }
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signIn, signUp, signOut,
      isAdmin: profile?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
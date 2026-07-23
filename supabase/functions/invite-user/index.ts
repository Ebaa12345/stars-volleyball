import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Дуудаж буй хэрэглэгчийн JWT-г шалгаж, зөвхөн admin эрхтэй л
    // (service-role-той admin.inviteUserByEmail) энэ функцийг дуудаж
    // чадахаар хамгаална — өмнө нь энэ шалгалт байгаагүй тул CORS "*"-тай
    // хамт хэн ч (баталгаажуулалтгүй) дурын и-мэйл рүү урилга илгээж болдог
    // байсан.
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Нэвтрээгүй байна.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Зөвхөн admin урилга илгээж чадна.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { email, redirectTo } = await req.json()

    // redirectTo-г client-ээс дамжуулна (эсвэл SITE_URL орчны хувьсагч) —
    // өмнө нь http://localhost:5173/login гэж хатуу бичигдсэн байсан тул
    // production дээр урилгын линк буруу хаяг руу очдог байсан.
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo || `${Deno.env.get('SITE_URL') ?? ''}/login`,
    })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders
    })
  }
})

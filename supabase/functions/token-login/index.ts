import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { auth_token } = await req.json()

    if (!auth_token) {
      throw new Error('Токен не указан')
    }

    // Находим профиль по токену
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('auth_token', auth_token)
      .single()

    if (profileError || !profile) {
      throw new Error('Неверный токен')
    }

    // Создаем сессию для пользователя
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${profile.user_id}@temp.app`, // временный email
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify`
      }
    })

    if (error) {
      console.error('Generate link error:', error)
      throw error
    }

    // Получаем данные пользователя
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      profile.user_id
    )

    if (userError || !userData) {
      throw new Error('Пользователь не найден')
    }

    // Создаем сессию вручную
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      user_id: profile.user_id
    })

    if (sessionError || !sessionData) {
      console.error('Session error:', sessionError)
      throw new Error('Не удалось создать сессию')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        session: sessionData.session
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

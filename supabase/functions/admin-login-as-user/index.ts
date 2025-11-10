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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Требуется авторизация' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Проверяем что текущий пользователь - админ
    const { data: { user: currentUser } } = await supabaseClient.auth.getUser()
    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: 'Пользователь не авторизован' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single()

    if (!adminRole || adminRole.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Доступ запрещён. Только администраторы могут входить как пользователь' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Получаем user_id целевого пользователя
    const { target_user_id } = await req.json()

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: 'Не указан ID пользователя' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Проверяем что целевой пользователь существует
    const { data: targetProfile } = await supabaseClient
      .from('profiles')
      .select('user_id, full_name, client_code')
      .eq('user_id', target_user_id)
      .single()

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Пользователь не найден' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Используем service role для создания сессии от имени пользователя
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

    // Создаём ссылку для входа от имени пользователя
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${targetProfile.client_code.toLowerCase()}@abucargo.app`,
    })

    if (linkError || !linkData) {
      console.error('Error generating link:', linkError)
      return new Response(
        JSON.stringify({ error: 'Не удалось создать сессию' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Admin ${currentUser.id} logged in as user ${target_user_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        hashed_token: linkData.properties.hashed_token,
        user_name: targetProfile.full_name,
        admin_id: currentUser.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Произошла ошибка' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

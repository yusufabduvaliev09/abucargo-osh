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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Требуется авторизация' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Create client with user's token to check their role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Check if user is admin
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Пользователь не авторизован' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!userRole || userRole.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Доступ запрещён' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Create admin client for operations
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

    // 🔥 ВРЕМЕННАЯ ФУНКЦИЯ: УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
    // Добавьте параметр ?action=deleteAll в URL для активации
    const url = new URL(req.url)
    if (url.searchParams.get('action') === 'deleteAll') {
      // Удаляем всех пользователей из profiles
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (profilesError) {
        return new Response(
          JSON.stringify({ error: `Ошибка удаления profiles: ${profilesError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Получаем всех пользователей auth для удаления
      const { data: authUsers, error: authListError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (authListError) {
        return new Response(
          JSON.stringify({ error: `Ошибка получения пользователей auth: ${authListError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Удаляем каждого пользователя из auth (кроме текущего админа)
      let deletedAuthCount = 0
      for (const authUser of authUsers.users) {
        if (authUser.id !== user.id) { // Не удаляем текущего админа
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id)
          if (!deleteError) {
            deletedAuthCount++
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Удалено ${deletedAuthCount} пользователей из auth и все записи из profiles`,
          deleted_auth_users: deletedAuthCount
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // ОРИГИНАЛЬНЫЙ КОД СОЗДАНИЯ ПОЛЬЗОВАТЕЛЯ
    const { client_code, full_name, phone, pvz_location, password } = await req.json()

    if (!client_code || !full_name || !phone || !pvz_location || !password) {
      return new Response(
        JSON.stringify({ error: 'Все поля обязательны' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Проверяем уникальность client_code
    const { data: existingByCode } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('client_code', client_code)
      .maybeSingle()

    if (existingByCode) {
      return new Response(
        JSON.stringify({ error: `Пользователь с ID ${client_code} уже существует` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Проверяем уникальность телефона
    const { data: existingByPhone } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (existingByPhone) {
      return new Response(
        JSON.stringify({ error: `Пользователь с телефоном ${phone} уже существует` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Создаем email из телефона (без +)
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const email = `${cleanPhone}@abucargo.app`

    // Создаем пользователя с указанным паролем и передаем client_code в metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
        pvz_location,
        client_code  // ВАЖНО: триггер handle_new_user прочитает это поле и не будет авто-генерировать ID
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Ошибка создания пользователя' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('User created:', authData.user.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        user_id: authData.user.id 
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
        status: 400 
      }
    )
  }
})

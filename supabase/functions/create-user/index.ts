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

    const { client_code, full_name, phone, pvz_location } = await req.json()

    if (!client_code || !full_name || !phone || !pvz_location) {
      throw new Error('Все поля обязательны')
    }

    // Проверяем, не существует ли уже пользователь с таким client_code
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('client_code', client_code)
      .single()

    if (existingProfile) {
      throw new Error('Пользователь с таким ID уже существует')
    }

    // Создаем email из client_code
    const email = `${client_code.toLowerCase()}@abucargo.app`
    
    // Генерируем случайный пароль (не используется для входа)
    const password = crypto.randomUUID()

    // Создаем пользователя
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
        pvz_location,
        client_code
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      throw authError
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
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

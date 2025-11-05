import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Creating system admin...')

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

    // Check if admin already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('phone', '+996558105551')
      .maybeSingle()

    if (existingProfile) {
      return new Response(
        JSON.stringify({ message: 'Admin already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Create admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: '996558105551@admin.local',
      phone: '+996558105551',
      password: 'admin123',
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        full_name: 'Системный Администратор',
        phone: '+996558105551',
        pvz_location: 'nariman'
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      throw authError
    }

    console.log('Admin user created:', authData.user.id)

    // The trigger will create the profile and default user role
    // We just need to update the role to admin
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: 'admin' })
      .eq('user_id', authData.user.id)

    if (roleError) {
      console.error('Role error:', roleError)
      throw roleError
    }

    console.log('Admin role assigned')

    return new Response(
      JSON.stringify({ 
        message: 'Admin created successfully',
        phone: '+996558105551',
        password: 'admin123'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

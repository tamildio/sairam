import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    const adminPassword = Deno.env.get('ADMIN_PASSWORD');

    if (!adminPassword) {
      throw new Error('Admin password not configured');
    }

    if (password !== adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a simple session token (hash of password + timestamp for uniqueness)
    const sessionToken = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(adminPassword + Date.now())
    );
    const token = Array.from(new Uint8Array(sessionToken))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Store session token with 24 hour expiry
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

    console.log('Login successful, token generated');

    return new Response(
      JSON.stringify({ 
        token,
        expiresAt,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auth-login:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

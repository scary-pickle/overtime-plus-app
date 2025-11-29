import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;
const STORAGE_BUCKETS = ['exports', 'attachments'] as const;
const TABLES_IN_DELETE_ORDER = [
  'attachments',
  'export_batches',
  'overtime_logs',
  'shifts',
  'profiles',
] as const;

type TableName = (typeof TABLES_IN_DELETE_ORDER)[number];

async function deleteTableRows(client: ReturnType<typeof createClient>, table: TableName, userId: string) {
  const { error } = await client.from(table).delete().eq('user_id', userId);
  if (error && error.code !== 'PGRST116') {
    // Ignore "Results contain 0 rows" errors, but fail everything else
    throw new Error(`Failed to delete rows from ${table}: ${error.message}`);
  }
}

async function deleteStoragePrefix(client: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  // List files under the prefix in batches to avoid hitting limits
  const limit = 100;
  let page = 0;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit,
      offset: page * limit,
    });

    if (error) {
      // Treat "not found" or empty folder as success
      if (error.message?.toLowerCase().includes('folder not found')) {
        return;
      }
      throw new Error(`Failed to list ${bucket}/${prefix}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return;
    }

    const paths = data.map((entry) => `${prefix}/${entry.name}`);
    const { error: removeError } = await client.storage.from(bucket).remove(paths);
    if (removeError) {
      throw new Error(`Failed to delete ${bucket}/${prefix}: ${removeError.message}`);
    }

    if (data.length < limit) {
      return;
    }

    page += 1;
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[delete-account] Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const userScopedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await userScopedClient.auth.getUser();
    if (userError || !userData?.user) {
      console.warn('[delete-account] Failed to resolve user from token', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const userId = userData.user.id;
    console.log('[delete-account] Hard delete requested', { userId });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    for (const table of TABLES_IN_DELETE_ORDER) {
      await deleteTableRows(adminClient, table, userId);
    }

    for (const bucket of STORAGE_BUCKETS) {
      try {
        await deleteStoragePrefix(adminClient, bucket, userId);
      } catch (storageError) {
        console.error(`[delete-account] Storage cleanup failed for ${bucket}`, storageError);
        throw storageError;
      }
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    console.log('[delete-account] Hard delete completed', { userId });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    console.error('[delete-account] Error processing request', error);
    return new Response(JSON.stringify({ error: error?.message ?? 'server_error' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});


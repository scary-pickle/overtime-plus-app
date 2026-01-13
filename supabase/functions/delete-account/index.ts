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
  let totalDeleted = 0;
  const errors: string[] = [];

  while (true) {
    try {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit,
        offset: page * limit,
      });

      if (error) {
        // Treat "not found" or empty folder as success
        if (error.message?.toLowerCase().includes('folder not found')) {
          console.log(`[delete-account] Bucket ${bucket}/${prefix} not found (already empty)`);
          break;
        }
        // Log but don't throw - best effort deletion
        console.error(`[delete-account] Failed to list ${bucket}/${prefix}:`, error);
        errors.push(`List error: ${error.message}`);
        break; // Can't continue if we can't list
      }

      if (!data || data.length === 0) {
        break;
      }

      // Construct paths - handle both flat and nested structures
      const paths = data.map((entry) => {
        // If entry.name already includes the prefix, use it directly
        // Otherwise, construct the path
        return entry.name.startsWith(prefix) 
          ? entry.name 
          : `${prefix}/${entry.name}`;
      });

      const { error: removeError } = await client.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`[delete-account] Failed to delete batch from ${bucket}/${prefix}:`, removeError);
        errors.push(`Delete error: ${removeError.message}`);
        // Continue anyway - might be partial success, or files might not exist
      } else {
        totalDeleted += paths.length;
        console.log(`[delete-account] Deleted ${paths.length} files from ${bucket}/${prefix} (total: ${totalDeleted})`);
      }

      if (data.length < limit) {
        break;
      }

      page += 1;
    } catch (error) {
      console.error(`[delete-account] Unexpected error in storage deletion for ${bucket}/${prefix}:`, error);
      errors.push(`Unexpected error: ${error?.message ?? 'unknown'}`);
      break;
    }
  }

  if (errors.length > 0) {
    console.warn(`[delete-account] Storage deletion completed with ${errors.length} errors for ${bucket}/${prefix} (deleted ${totalDeleted} files)`);
  } else if (totalDeleted > 0) {
    console.log(`[delete-account] Successfully deleted ${totalDeleted} files from ${bucket}/${prefix}`);
  }
  
  // Don't throw - best effort deletion (storage failures shouldn't block account deletion)
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
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
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
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const userId = userData.user.id;
    console.log('[delete-account] Hard delete requested', { userId });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Idempotency check: Verify account is marked for deletion (best practice)
    try {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('account_deleted_at')
        .eq('user_id', userId)
        .single();
      
      if (profile && !profile.account_deleted_at) {
        console.warn('[delete-account] Account not marked for deletion, but proceeding with hard delete', { userId });
      } else if (profile?.account_deleted_at) {
        console.log('[delete-account] Account already marked for deletion, proceeding with hard delete', { 
          userId,
          deletedAt: profile.account_deleted_at 
        });
      }
    } catch (profileError) {
      // Non-fatal - profile might not exist or query might fail
      console.warn('[delete-account] Could not check deletion status (non-fatal):', profileError);
    }

    // Delete table rows
    console.log('[delete-account] Deleting table rows', { userId, tables: TABLES_IN_DELETE_ORDER });
    for (const table of TABLES_IN_DELETE_ORDER) {
      try {
        await deleteTableRows(adminClient, table, userId);
        console.log(`[delete-account] Deleted rows from ${table}`, { userId });
      } catch (tableError) {
        console.error(`[delete-account] Failed to delete rows from ${table}:`, tableError);
        throw tableError; // Table deletion failures are critical
      }
    }

    // Delete storage files (best-effort, non-blocking)
    console.log('[delete-account] Deleting storage files', { userId, buckets: STORAGE_BUCKETS });
    for (const bucket of STORAGE_BUCKETS) {
      try {
        await deleteStoragePrefix(adminClient, bucket, userId);
      } catch (storageError) {
        // Log but don't throw - storage deletion is best-effort
        console.error(`[delete-account] Storage cleanup failed for ${bucket} (non-fatal):`, storageError);
      }
    }

    // Delete auth user (must be last step)
    console.log('[delete-account] Deleting auth user', { userId });
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('[delete-account] Failed to delete auth user:', deleteAuthError);
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    console.log('[delete-account] Hard delete completed successfully', { userId });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'server_error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[delete-account] Error processing request', {
      error: errorMessage,
      stack: errorStack,
      // Note: userId might not be available if error occurred before resolution
    });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});





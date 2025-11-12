#!/usr/bin/env python3
"""
Execute SQL in production Supabase using service role key
Usage: python3 scripts/execute_production_sql.py <SERVICE_ROLE_KEY>
"""

import sys
import requests
import json

def execute_sql(supabase_url, service_role_key, sql):
    """Execute SQL using Supabase Management API"""
    # Supabase doesn't have a direct SQL execution API endpoint
    # We need to use the PostgreSQL connection or CLI
    
    # Alternative: Use the REST API with a stored procedure if available
    # For now, we'll use the direct approach with psql connection string
    
    print("Note: Supabase REST API doesn't support direct SQL execution.")
    print("We'll need to use one of these methods:")
    print("")
    print("METHOD 1: Supabase CLI")
    print("  supabase link --project-ref ethllesuiqlomdtctvdh")
    print("  supabase db execute --file supabase/sql/pdf_templates_production.sql")
    print("")
    print("METHOD 2: Direct psql connection")
    print("  Get connection string from: Dashboard → Settings → Database")
    print("  Then: psql '<connection-string>' -f supabase/sql/pdf_templates_production.sql")
    print("")
    print("METHOD 3: Supabase Dashboard SQL Editor (Easiest)")
    print("  https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/sql/new")
    
    return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/execute_production_sql.py <SERVICE_ROLE_KEY>")
        sys.exit(1)
    
    service_role_key = sys.argv[1]
    supabase_url = "https://ethllesuiqlomdtctvdh.supabase.co"
    
    # Read SQL file
    sql_file = "supabase/sql/pdf_templates_production.sql"
    try:
        with open(sql_file, 'r') as f:
            sql = f.read()
    except FileNotFoundError:
        print(f"Error: SQL file not found: {sql_file}")
        sys.exit(1)
    
    execute_sql(supabase_url, service_role_key, sql)


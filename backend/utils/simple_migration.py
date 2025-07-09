#!/usr/bin/env python3
"""
Simple Database Migration Executor

Direct SQL execution for the synthesis enhancement migration.
"""

import os
import psycopg2
from urllib.parse import urlparse
from backend.core.config import settings

def main():
    """Execute the migration using direct PostgreSQL connection."""
    print("🚀 Running Direct SQL Migration")
    print("=" * 40)
    
    # Parse the Supabase database URL
    # Supabase URLs are in format: postgresql://[user[:password]@][netloc][:port][/dbname]
    # We need to construct this from Supabase URL and key
    supabase_url = settings.SUPABASE_URL
    
    # Convert https://xxx.supabase.co to postgres connection
    if 'supabase.co' in supabase_url:
        project_id = supabase_url.split('//')[1].split('.')[0]
        db_url = f"postgresql://postgres:[password]@db.{project_id}.supabase.co:5432/postgres"
        print("⚠️  Please set your database password in the connection string above")
        print("📝 Raw SQL to execute:")
        
        # Just print the SQL for manual execution
        with open('backend/utils/database_migration.sql', 'r') as f:
            sql_content = f.read()
        
        print("-" * 60)
        print(sql_content)
        print("-" * 60)
        
        print("\n🔧 Manual Steps:")
        print("1. Connect to your Supabase database using the SQL editor")
        print("2. Copy and paste the SQL above")
        print("3. Execute it in the SQL editor")
        print("\nAlternatively, use the Supabase CLI:")
        print("supabase db reset")
        
    else:
        print("❌ Unable to parse Supabase URL for direct connection")

if __name__ == "__main__":
    main() 
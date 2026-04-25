import psycopg2
import sys

# Replace with the actual URL taking port into account
DB_URL = "postgres://postgres:HelloSKC808%40%40@db.nkctzzerpcughgwhpduf.supabase.co:5432/postgres?sslmode=require"
SQL_FILE = "D:/DevVault/SAP_CLONE/supabase/migrations/20260417000010_advanced_forecasting_schema.sql"

try:
    with open(SQL_FILE, 'r') as f:
        sql = f.read()

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    cursor.execute(sql)
    print("Migration applied successfully!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
finally:
    if 'conn' in locals() and conn:
        conn.close()

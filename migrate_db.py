
import sqlite3

try:
    conn = sqlite3.connect("SHYNOTE.db")
    cursor = conn.cursor()
    # Check if column exists
    cursor.execute("PRAGMA table_info(notes)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "version" not in columns:
        print("Adding version column...")
        cursor.execute("ALTER TABLE notes ADD COLUMN version INTEGER DEFAULT 1")
        conn.commit()
        print("Migration successful: Added 'version' column.")
    else:
        print("Migration skipped: 'version' column already exists.")
        
    conn.close()
except Exception as e:
    print(f"Migration failed: {e}")

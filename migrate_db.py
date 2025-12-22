import sqlite3

# Connect to the SQLite database
conn = sqlite3.connect('SHYNOTE.db')
cursor = conn.cursor()

# Check and add 'is_pinned' column
try:
    cursor.execute("SELECT is_pinned FROM notes LIMIT 1")
    print("'is_pinned' column already exists.")
except sqlite3.OperationalError:
    print("Adding 'is_pinned' column...")
    cursor.execute("ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN DEFAULT 0")
    print("'is_pinned' column added.")

# Commit and close
conn.commit()
conn.close()

import sqlite3
from pathlib import Path

DB_DIR = Path.home() / ".natlas"
DB_FILE = DB_DIR / "natlas.db"

def get_db_connection():
    """Create a connection to the SQLite database and set row factory to Row."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database schemas, creating necessary tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Drop legacy chats table if exists
    cursor.execute("DROP TABLE IF EXISTS chats")
    
    # 1. Create task_history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_text TEXT NOT NULL,
        project TEXT,
        user_name TEXT,
        task_slug TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Create build_logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS build_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL, -- 'ingest' or 'compile'
        status TEXT NOT NULL, -- 'done' or 'error'
        log_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    conn.commit()
    conn.close()

def execute_query(query: str, params: tuple = (), fetch_all: bool = False, fetch_one: bool = False, commit: bool = False):
    """Execute SQL query safely and handle connection lifecycle automatically."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(query, params)
        if commit:
            conn.commit()
            return cursor.lastrowid
        if fetch_all:
            # Convert Rows to normal dictionaries for easy JSON serialization in routers
            return [dict(row) for row in cursor.fetchall()]
        if fetch_one:
            row = cursor.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()

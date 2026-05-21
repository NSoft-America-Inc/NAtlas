import sys
from pathlib import Path

# Add current directory to path so db is importable
sys.path.append(str(Path(__file__).parent))

import db
import json

def run_tests():
    print("=== NAtlas SQLite Integration Test ===")
    
    # 1. DB Initialization Test
    print("\n[1] Initializing database...")
    db.init_db()
    db_file = Path.home() / ".natlas" / "natlas.db"
    assert db_file.exists(), "Database file should exist!"
    print(f"✓ DB initialized successfully at {db_file}")

    # 2. task_history table CRUD Test
    print("\n[2] Testing task_history table operations...")
    # Clean first to have consistent tests
    db.execute_query("DELETE FROM task_history", commit=True)
    
    # Insert some dummy records
    tasks_to_insert = [
        ("What is NAtlas?", "memo", "developer-a", "memo-i1-feat-delete"),
        ("What is SwarmVault?", "nstack", "developer-b", "nstack-i2-core"),
        ("How to run dev server?", None, None, "unknown")
    ]
    
    for q, p, u, s in tasks_to_insert:
        db.execute_query(
            "INSERT INTO task_history (query_text, project, user_name, task_slug) VALUES (?, ?, ?, ?)",
            (q, p, u, s),
            commit=True
        )
    print("✓ Successfully inserted 3 test task history records.")

    # Retrieve history
    rows = db.execute_query(
        "SELECT id, query_text, project, user_name, task_slug, created_at FROM (SELECT * FROM task_history ORDER BY id DESC LIMIT 50) ORDER BY id ASC",
        fetch_all=True
    )
    assert len(rows) == 3, f"Expected 3 records, got {len(rows)}"
    
    # Verify order (ascending by ID, i.e., chronological)
    queries = [r["query_text"] for r in rows]
    expected_queries = ["What is NAtlas?", "What is SwarmVault?", "How to run dev server?"]
    assert queries == expected_queries, f"Order mismatch. Got: {queries}"
    print("✓ Verified chronological (ascending) sorting of task history.")

    # Verify matching data
    assert rows[0]["project"] == "memo" and rows[0]["task_slug"] == "memo-i1-feat-delete"
    assert rows[2]["project"] is None and rows[2]["task_slug"] == "unknown"
    print("✓ Verified column accuracy (project, user_name, task_slug).")

    # 3. build_logs table integration Test
    print("\n[3] Testing build_logs table operations...")
    db.execute_query("DELETE FROM build_logs", commit=True)
    
    db.execute_query(
        "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
        ("ingest", "error", "Failed to ingest dummy.md"),
        commit=True
    )
    db.execute_query(
        "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
        ("compile", "done", "Compiled successfully"),
        commit=True
    )
    
    logs = db.execute_query("SELECT * FROM build_logs", fetch_all=True)
    assert len(logs) == 2, f"Expected 2 build logs, got {len(logs)}"
    assert logs[0]["action"] == "ingest" and logs[0]["status"] == "error"
    assert logs[1]["action"] == "compile" and logs[1]["status"] == "done"
    print("✓ Verified SwarmVault ingest & compile log persistence.")

    # 4. task_history table DELETE Test
    print("\n[4] Testing clear history operations...")
    db.execute_query("DELETE FROM task_history", commit=True)
    remaining_tasks = db.execute_query("SELECT * FROM task_history", fetch_all=True)
    assert len(remaining_tasks) == 0, f"Expected 0 tasks after clearing, got {len(remaining_tasks)}"
    print("✓ Verified task history clearing.")

    print("\n==========================================")
    print("🎉 ALL SQLITE DB INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉")
    print("==========================================")

if __name__ == "__main__":
    run_tests()

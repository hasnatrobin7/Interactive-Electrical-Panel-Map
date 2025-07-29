#!/usr/bin/env python3
"""
Enhanced HTTP server for the ATE Monitor Interactive Map.

Major additions:
1. SQLite-based user database with a default admin account (username: admin, password: admin).
2. Simple session management via HTTP cookies.
3. REST-style API endpoints:
   • POST  /api/login      – Authenticate user and issue session cookie.
   • POST  /api/logout     – Destroy current session.
   • GET   /api/session    – Return information about the currently logged-in user.
   • POST  /api/register   – Admin-only endpoint to create a new user with specific permissions.
4. Existing /upload_runs endpoint now requires an authenticated user who has the “upload_runs” permission (or is_admin).

The server still serves all static files from the project directory using the built-in SimpleHTTPRequestHandler.
"""

import http.server
import socketserver
import os
import json
import uuid
import hashlib
import sqlite3
from http import cookies
from pathlib import Path
from urllib.parse import parse_qs

PORT = 8000
PROJECT_DIR = Path(__file__).parent.absolute()
DB_PATH = PROJECT_DIR / "users.db"

# ------------------------- Utility helpers ------------------------- #

def hash_password(password: str, salt: str | None = None) -> str:
    """Return "salt$hash" using SHA-256. If salt is None, a new one is generated."""
    if salt is None:
        salt = uuid.uuid4().hex
    digest = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${digest}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _hash = stored.split("$", 1)
    except ValueError:
        return False
    return hash_password(password, salt).split("$", 1)[1] == _hash


def dict_from_row(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}

# --------------------------- Database setup ------------------------ #

def init_db():
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        username     TEXT UNIQUE NOT NULL,
        password_hash TEXT        NOT NULL,
        is_admin     INTEGER      NOT NULL DEFAULT 0,
        permissions  TEXT         NOT NULL DEFAULT '{}'
    );
    """
    admin_check_sql = "SELECT COUNT(*) FROM users WHERE is_admin = 1"
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(create_table_sql)
        cur = conn.execute(admin_check_sql)
        (admin_count,) = cur.fetchone()
        if admin_count == 0:
            # Create default admin account
            pwd_hash = hash_password("admin")
            default_perms = json.dumps({"edit": True, "upload_runs": True, "manage_users": True})
            conn.execute(
                "INSERT INTO users (username, password_hash, is_admin, permissions) VALUES (?,?,?,?)",
                ("admin", pwd_hash, 1, default_perms),
            )
            conn.commit()
            print("[INFO] Default admin account created → username: admin, password: admin")

# Ensure DB is ready at import time
init_db()

# ----------------------- Session management ----------------------- #

SESSIONS: dict[str, int] = {}  # token -> user_id
SESSION_COOKIE_NAME = "session"


def create_session(user_id: int) -> str:
    token = uuid.uuid4().hex
    SESSIONS[token] = user_id
    return token


def destroy_session(token: str):
    SESSIONS.pop(token, None)


def get_user_by_id(user_id: int) -> dict | None:
    """Return user dict or None."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict_from_row(row) if row else None

# ----------------------- HTTP Request Handler --------------------- #

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/session"):
            self.handle_get_session()
        elif self.path.startswith("/api/users"):
            # Admin-only list or fetch user
            self.handle_get_users()
        else:
            # Delegate to default static file serving
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/login":
            self.handle_login()
        elif self.path == "/api/logout":
            self.handle_logout()
        elif self.path == "/api/register":
            self.handle_register()
        elif self.path == "/upload_runs":
            # Existing endpoint – now with auth
            self.require_permission("upload_runs")
            self.handle_upload_runs()
        else:
            self.send_error(404, "Unsupported endpoint")

    def do_PUT(self):
        # Handle user update: /api/users/<id>
        if self.path.startswith("/api/users/"):
            try:
                user_id = int(self.path.split("/api/users/")[-1])
            except ValueError:
                self.send_error(400, "Invalid user id")
                return
            self.handle_update_user(user_id)
        else:
            self.send_error(404, "Unsupported endpoint")

    def do_DELETE(self):
        # Handle delete user: /api/users/<id>
        if self.path.startswith("/api/users/"):
            try:
                user_id = int(self.path.split("/api/users/")[-1])
            except ValueError:
                self.send_error(400, "Invalid user id")
                return
            self.handle_delete_user(user_id)
        else:
            self.send_error(404, "Unsupported endpoint")

    # ----------------------- Helper methods ----------------------- #

    def send_json(self, data: dict, status: int = 200, extra_headers: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def parse_json_body(self) -> dict | None:
        length = int(self.headers.get("Content-Length", 0))
        try:
            raw = self.rfile.read(length)
            return json.loads(raw.decode()) if raw else None
        except json.JSONDecodeError:
            return None

    def get_cookie(self, name: str) -> str | None:
        if "Cookie" not in self.headers:
            return None
        c = cookies.SimpleCookie(self.headers["Cookie"])
        if name in c:
            return c[name].value
        return None

    def get_current_user(self) -> dict | None:
        token = self.get_cookie(SESSION_COOKIE_NAME)
        if not token or token not in SESSIONS:
            return None
        return get_user_by_id(SESSIONS[token])

    def require_permission(self, perm: str):
        user = self.get_current_user()
        if not user:
            self.send_error(401, "Authentication required")
            raise ConnectionAbortedError
        if user.get("is_admin"):
            return  # admins bypass permission checks
        perms = json.loads(user.get("permissions", "{}"))
        if not perms.get(perm, False):
            self.send_error(403, "Insufficient permissions")
            raise ConnectionAbortedError
        # else allowed

    # ----------------------- Endpoint handlers -------------------- #

    def handle_get_session(self):
        user = self.get_current_user()
        if not user:
            self.send_error(401, "Unauthorized")
            return
        # Convert permissions JSON string to object for ease of use on client
        user_resp = {
            "id": user["id"],
            "username": user["username"],
            "is_admin": bool(user["is_admin"]),
            "permissions": json.loads(user.get("permissions", "{}")),
        }
        self.send_json({"user": user_resp})

    def handle_login(self):
        data = self.parse_json_body()
        if not data or "username" not in data or "password" not in data:
            self.send_error(400, "username and password required")
            return
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM users WHERE username = ?", (data["username"],))
            row = cur.fetchone()
            if not row or not verify_password(data["password"], row["password_hash"]):
                self.send_error(401, "Invalid credentials")
                return
            user = dict_from_row(row)
        token = create_session(user["id"])
        cookie_hdr = f"{SESSION_COOKIE_NAME}={token}; Path=/; HttpOnly"
        user_resp = {
            "id": user["id"],
            "username": user["username"],
            "is_admin": bool(user["is_admin"]),
            "permissions": json.loads(user.get("permissions", "{}")),
        }
        self.send_json({"status": "success", "user": user_resp}, extra_headers={"Set-Cookie": cookie_hdr})

    def handle_logout(self):
        token = self.get_cookie(SESSION_COOKIE_NAME)
        if token:
            destroy_session(token)
        # Clear cookie
        hdr = f"{SESSION_COOKIE_NAME}=deleted; Path=/; Max-Age=0"
        self.send_json({"status": "success"}, extra_headers={"Set-Cookie": hdr})

    def handle_register(self):
        # Only admin can add users
        user = self.get_current_user()
        if not user or not user.get("is_admin"):
            self.send_error(403, "Admin privileges required")
            return
        data = self.parse_json_body() or {}
        username = data.get("username")
        password = data.get("password")
        permissions = data.get("permissions", {})
        is_admin = int(bool(data.get("is_admin", 0)))
        if not username or not password:
            self.send_error(400, "username and password required")
            return
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.execute(
                    "INSERT INTO users (username, password_hash, is_admin, permissions) VALUES (?,?,?,?)",
                    (
                        username,
                        hash_password(password),
                        is_admin,
                        json.dumps(permissions),
                    ),
                )
                conn.commit()
        except sqlite3.IntegrityError:
            self.send_error(409, "Username already exists")
            return
        self.send_json({"status": "user_created"}, status=201)

    def handle_upload_runs(self):
        """Original /upload_runs logic from the previous implementation."""
        content_length = int(self.headers.get("Content-Length", 0))
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self.send_error(400, "Expected multipart/form-data")
            return
        boundary = content_type.split("boundary=")[-1].encode()
        body = self.rfile.read(content_length)
        parts = body.split(b"--" + boundary)
        file_content = None
        filename = None
        for part in parts:
            if b"Content-Disposition" in part and b'name="file"' in part:
                header_end = part.find(b"\r\n\r\n")
                header = part[:header_end].decode(errors="ignore")
                if 'filename="' in header:
                    filename = header.split('filename="')[-1].split('"')[0]
                file_content = part[header_end + 4 : -2]  # strip trailing CRLF
                break
        if not filename or file_content is None:
            self.send_error(400, "File not found in request")
            return
        try:
            with open(PROJECT_DIR / filename, "wb") as f:
                f.write(file_content)
            self.send_json({"status": "OK"})
            print(f"[INFO] Uploaded and saved {filename}")
        except Exception as exc:
            self.send_error(500, f"Could not save file: {exc}")

    # ---------------- User admin helpers ------------------ #

    def handle_get_users(self):
        # Must be admin
        user = self.get_current_user()
        if not user or not user.get("is_admin"):
            self.send_error(403, "Admin privileges required")
            return
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT id, username, is_admin, permissions FROM users").fetchall()
            users = [
                {
                    "id": r["id"],
                    "username": r["username"],
                    "is_admin": bool(r["is_admin"]),
                    "permissions": json.loads(r["permissions"] or "{}"),
                }
                for r in rows
            ]
        self.send_json({"users": users})

    def handle_update_user(self, target_id: int):
        # Must be admin; cannot demote self from last admin
        actor = self.get_current_user()
        if not actor or not actor.get("is_admin"):
            self.send_error(403, "Admin privileges required")
            return
        data = self.parse_json_body() or {}
        fields = []
        values = []
        if "username" in data:
            fields.append("username = ?")
            values.append(data["username"])
        if "password" in data and data["password"]:
            fields.append("password_hash = ?")
            values.append(hash_password(data["password"]))
        if "is_admin" in data:
            fields.append("is_admin = ?")
            values.append(int(bool(data["is_admin"])) )
        if "permissions" in data:
            fields.append("permissions = ?")
            values.append(json.dumps(data["permissions"]))
        if not fields:
            self.send_error(400, "No fields to update")
            return
        values.append(target_id)
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
                conn.commit()
        except sqlite3.IntegrityError:
            self.send_error(409, "Username already exists")
            return
        self.send_json({"status": "updated"})

    def handle_delete_user(self, target_id: int):
        actor = self.get_current_user()
        if not actor or not actor.get("is_admin"):
            self.send_error(403, "Admin privileges required")
            return
        # Prevent deleting self if last admin
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute("SELECT is_admin FROM users WHERE id = ?", (target_id,))
            row = cur.fetchone()
            if not row:
                self.send_error(404, "User not found")
                return
            target_is_admin = bool(row[0])
            if target_is_admin:
                cur2 = conn.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1")
                (admin_count,) = cur2.fetchone()
                if admin_count <= 1:
                    self.send_error(400, "Cannot delete the last admin user")
                    return
            conn.execute("DELETE FROM users WHERE id = ?", (target_id,))
            conn.commit()
        self.send_json({"status": "deleted"})

# ---------------------------- Main entry --------------------------- #

if __name__ == "__main__":
    os.chdir(PROJECT_DIR)
    # Try to bind; if port is already in use, increment until we find a free one
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    import socket

    actual_port = PORT
    while True:
        try:
            httpd = ReusableTCPServer(("", actual_port), CustomHandler)
            break
        except OSError as e:
            if e.errno in (10048, 48):  # Address already in use (Windows or Unix)
                actual_port += 1
                if actual_port > PORT + 20:
                    raise RuntimeError("No available ports in range 8000-8020") from e
            elif e.errno in (10013, 13):  # Permission denied
                actual_port += 1
                if actual_port > PORT + 20:
                    raise RuntimeError("Ports require elevated privileges or are blocked (8000-8020)") from e
            else:
                raise

    with httpd:
        print(f"Starting server at http://localhost:{PORT}")
        if actual_port != PORT:
            print(f"Port {PORT} in use, switched to {actual_port}")
        print(f"Serving files from: {PROJECT_DIR}")
        print("Press Ctrl+C to stop the server (Default admin → user: admin, password: admin)")
        try:
            import webbrowser

            webbrowser.open(f"http://localhost:{actual_port}/index.html")
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.") 
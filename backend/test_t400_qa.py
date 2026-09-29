#!/usr/bin/env python3
import json
import time
import base64
import hmac
import hashlib
import urllib.request
import urllib.error
import subprocess
import sys

BASE_URL = "http://localhost:8080"
DB_CONTAINER = "smasara-workspace-db-1"
JWT_SECRET = b"smasara-knowledge-vault-secret"

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def generate_jwt(user_id: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id,
        "exp": int(time.time()) + 72 * 3600
    }
    h_b64 = b64url(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    p_b64 = b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{h_b64}.{p_b64}".encode('utf-8')
    sig = b64url(hmac.new(JWT_SECRET, signing_input, hashlib.sha256).digest())
    return f"{h_b64}.{p_b64}.{sig}"

def run_psql(sql: str) -> str:
    cmd = ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "smasara_db", "-q", "-t", "-A", "-c", sql]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"PSQL Error: {res.stderr.strip()}")
    lines = [line.strip() for line in res.stdout.strip().splitlines() if line.strip() and not line.strip().startswith("INSERT") and not line.strip().startswith("DELETE") and not line.strip().startswith("UPDATE")]
    return lines[0] if lines else ""

def http_request(method: str, path: str, token: str = None, body: dict = None, raw_body: str = None) -> tuple[int, dict, str]:
    url = f"{BASE_URL}{path}"
    headers = {}
    data = None
    if token is not None:
        headers["Cookie"] = f"jwt_smasara={token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode('utf-8')
    elif raw_body is not None:
        headers["Content-Type"] = "application/json"
        data = raw_body.encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode('utf-8')
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = {}
            return resp.status, parsed, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8')
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {}
        return e.code, parsed, raw
    except Exception as e:
        return 0, {}, str(e)

def main():
    ts = int(time.time())
    results = []

    def record_pass(category: str, name: str):
        results.append(("PASS", category, name, ""))

    def record_fail(category: str, name: str, reason: str):
        results.append(("FAIL", category, name, reason))

    # --- 1. SETUP DB FIXTURES ---
    try:
        # User 1: Owner (has Workspace A and Workspace B)
        u1_email = f"t400_owner_{ts}@test.local"
        u1_id = run_psql(f"INSERT INTO users (email, password_hash) VALUES ('{u1_email}', 'dummy_hash') RETURNING id;")
        run_psql(f"INSERT INTO profiles (id, username, full_name) VALUES ('{u1_id}', 'owner_{ts}', 'QA Owner');")

        # User 2: Viewer in Workspace A
        u2_email = f"t400_viewer_{ts}@test.local"
        u2_id = run_psql(f"INSERT INTO users (email, password_hash) VALUES ('{u2_email}', 'dummy_hash') RETURNING id;")
        run_psql(f"INSERT INTO profiles (id, username, full_name) VALUES ('{u2_id}', 'viewer_{ts}', 'QA Viewer');")

        # User 3: Non-member (neither in WS A nor WS B)
        u3_email = f"t400_stranger_{ts}@test.local"
        u3_id = run_psql(f"INSERT INTO users (email, password_hash) VALUES ('{u3_email}', 'dummy_hash') RETURNING id;")
        run_psql(f"INSERT INTO profiles (id, username, full_name) VALUES ('{u3_id}', 'stranger_{ts}', 'QA Stranger');")

        # Workspace A
        wsA_id = run_psql(f"INSERT INTO workspaces (name, slug, created_by) VALUES ('WS_A_{ts}', 'ws-a-{ts}', '{u1_id}') RETURNING id;")
        run_psql(f"INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('{wsA_id}', '{u1_id}', 'OWNER');")
        run_psql(f"INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('{wsA_id}', '{u2_id}', 'VIEWER');")

        # Workspace B (for cross-workspace IDOR tests)
        wsB_id = run_psql(f"INSERT INTO workspaces (name, slug, created_by) VALUES ('WS_B_{ts}', 'ws-b-{ts}', '{u1_id}') RETURNING id;")
        run_psql(f"INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('{wsB_id}', '{u1_id}', 'OWNER');")

        # Create folder & document in Workspace B for IDOR
        folderB_id = run_psql(f"INSERT INTO folders (workspace_id, name) VALUES ('{wsB_id}', 'Folder In WS B') RETURNING id;")
        docB_id = run_psql(f"INSERT INTO documents (workspace_id, folder_id, author_id, title, content, is_public, slug) VALUES ('{wsB_id}', '{folderB_id}', '{u1_id}', 'Doc In WS B', 'content B', false, 'doc-in-ws-b-{ts}') RETURNING id;")

        token_owner = generate_jwt(u1_id)
        token_viewer = generate_jwt(u2_id)
        token_stranger = generate_jwt(u3_id)
    except Exception as e:
        print(f"Failed to setup database fixtures: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        # =========================================================================
        # 1. HAPPY PATH SCENARIOS
        # =========================================================================

        # HP-1: Create Root Folder
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, {"name": "Engineering"})
        folder_root_id = None
        if st == 201 and body.get("data", {}).get("name") == "Engineering":
            folder_root_id = body["data"]["id"]
            record_pass("Happy Path", "Create Root Folder")
        else:
            record_fail("Happy Path", "Create Root Folder", f"Status {st} != 201 or data mismatch: {raw}")

        # HP-2: Create Nested Child Folder
        folder_child_id = None
        if folder_root_id:
            st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, {
                "name": "Backend",
                "parent_id": folder_root_id
            })
            if st == 201 and body.get("data", {}).get("name") == "Backend":
                folder_child_id = body["data"]["id"]
                record_pass("Happy Path", "Create Nested Child Folder")
            else:
                record_fail("Happy Path", "Create Nested Child Folder", f"Status {st} != 201: {raw}")
        else:
            record_fail("Happy Path", "Create Nested Child Folder", "Skipped: Root folder creation failed")

        # HP-3: Create Deeply Nested Grandchild Folder
        folder_grandchild_id = None
        if folder_child_id:
            st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, {
                "name": "Database",
                "parent_id": folder_child_id
            })
            if st == 201 and body.get("data", {}).get("name") == "Database":
                folder_grandchild_id = body["data"]["id"]
                record_pass("Happy Path", "Create Deeply Nested Grandchild Folder")
            else:
                record_fail("Happy Path", "Create Deeply Nested Grandchild Folder", f"Status {st} != 201: {raw}")
        else:
            record_fail("Happy Path", "Create Deeply Nested Grandchild Folder", "Skipped: Child folder creation failed")

        # HP-4: Get Workspace Folders Tree / Hierarchy
        st, body, raw = http_request("GET", f"/api/workspaces/{wsA_id}/folders", token_owner)
        if st == 200:
            folders = body.get("data", [])
            f_ids = [f["id"] for f in folders]
            if folder_root_id in f_ids and folder_child_id in f_ids and folder_grandchild_id in f_ids:
                record_pass("Happy Path", "Get Workspace Folders Hierarchy")
            else:
                record_fail("Happy Path", "Get Workspace Folders Hierarchy", "Created folders not in hierarchy list")
        else:
            record_fail("Happy Path", "Get Workspace Folders Hierarchy", f"Status {st} != 200: {raw}")

        # HP-5: Create Document in Folder
        doc1_id = None
        if folder_root_id:
            st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/documents", token_owner, {
                "title": "Architecture README",
                "content": "Core architecture overview",
                "folder_id": folder_root_id
            })
            if st == 201 and body.get("document", {}).get("id"):
                doc1_id = body["document"]["id"]
                record_pass("Happy Path", "Create Document in Folder")
            else:
                record_fail("Happy Path", "Create Document in Folder", f"Status {st} != 201: {raw}")
        else:
            record_fail("Happy Path", "Create Document in Folder", "Skipped: Root folder creation failed")

        # HP-6: Set Folder Index Document (T-402)
        if folder_root_id and doc1_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}/index", token_owner, {
                "document_id": doc1_id
            })
            if st == 200:
                record_pass("Happy Path", "Set Folder Index Document")
            else:
                record_fail("Happy Path", "Set Folder Index Document", f"Status {st} != 200: {raw}")
        else:
            record_fail("Happy Path", "Set Folder Index Document", "Skipped: Folder or document unavailable")

        # HP-7: Get Folder With Index Document (T-402)
        if folder_root_id and doc1_id:
            st, body, raw = http_request("GET", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}", token_owner)
            idx_doc = body.get("index_document")
            if st == 200 and idx_doc and idx_doc.get("id") == doc1_id:
                record_pass("Happy Path", "Get Folder With Index Document")
            else:
                record_fail("Happy Path", "Get Folder With Index Document", f"Status {st} != 200 or index_document mismatch: {raw}")
        else:
            record_fail("Happy Path", "Get Folder With Index Document", "Skipped: Folder or document unavailable")

        # HP-8: Clear Folder Index Document (T-402)
        if folder_root_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}/index", token_owner, {
                "document_id": ""
            })
            st_get, body_get, _ = http_request("GET", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}", token_owner)
            if st == 200 and st_get == 200 and body_get.get("index_document") is None:
                record_pass("Happy Path", "Clear Folder Index Document")
            else:
                record_fail("Happy Path", "Clear Folder Index Document", f"Status {st} != 200 or index not cleared: {raw}")
        else:
            record_fail("Happy Path", "Clear Folder Index Document", "Skipped: Root folder unavailable")

        # HP-9: Move Document to Folder via PUT /documents/:id (T-403 Drag-and-Drop)
        doc2_id = None
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/documents", token_owner, {
            "title": "Drag Drop Test Note",
            "content": "Moving note content"
        })
        if st == 201:
            doc2_id = body["document"]["id"]
            doc2_ver = body["document"]["version"]

            # Move to child folder
            st_move, body_move, raw_move = http_request("PUT", f"/api/workspaces/{wsA_id}/documents/{doc2_id}", token_owner, {
                "title": "Drag Drop Test Note",
                "content": "Moving note content",
                "folder_id": folder_child_id,
                "version": doc2_ver
            })
            if st_move == 200 and body_move.get("document", {}).get("folder_id") == folder_child_id:
                record_pass("Happy Path", "Move Document to Folder")
            else:
                record_fail("Happy Path", "Move Document to Folder", f"Status {st_move} != 200 or folder_id mismatch: {raw_move}")
        else:
            record_fail("Happy Path", "Move Document to Folder", f"Failed creating doc: {raw}")

        # HP-10: Move Document Back to Root Uncategorized (T-403)
        if doc2_id and folder_child_id:
            # Current doc version is 2 after previous update
            st_root, body_root, raw_root = http_request("PUT", f"/api/workspaces/{wsA_id}/documents/{doc2_id}", token_owner, {
                "title": "Drag Drop Test Note",
                "content": "Moving note content",
                "folder_id": "",
                "version": 2
            })
            if st_root == 200 and body_root.get("document", {}).get("folder_id") is None:
                record_pass("Happy Path", "Move Document to Root Uncategorized")
            else:
                record_fail("Happy Path", "Move Document to Root Uncategorized", f"Status {st_root} != 200 or folder_id not null: {raw_root}")
        else:
            record_fail("Happy Path", "Move Document to Root Uncategorized", "Skipped: doc2_id unavailable")


        # =========================================================================
        # 2. NEGATIVE CASES SCENARIOS
        # =========================================================================

        # NC-1: Unauthorized Access Without Cookie/Token
        st, body, raw = http_request("GET", f"/api/workspaces/{wsA_id}/folders", token=None)
        if st == 401:
            record_pass("Negative Cases", "Unauthorized Access Without Cookie/Token")
        else:
            record_fail("Negative Cases", "Unauthorized Access Without Cookie/Token", f"Expected 401, got {st}: {raw}")

        # NC-2: Unauthorized Access With Invalid Token
        st, body, raw = http_request("GET", f"/api/workspaces/{wsA_id}/folders", token="invalid.token.signature")
        if st == 401:
            record_pass("Negative Cases", "Unauthorized Access With Invalid Token")
        else:
            record_fail("Negative Cases", "Unauthorized Access With Invalid Token", f"Expected 401, got {st}: {raw}")

        # NC-3: Access Workspace Folders Without Membership
        st, body, raw = http_request("GET", f"/api/workspaces/{wsA_id}/folders", token=token_stranger)
        if st == 403:
            record_pass("Negative Cases", "Access Workspace Folders Without Membership")
        else:
            record_fail("Negative Cases", "Access Workspace Folders Without Membership", f"Expected 403, got {st}: {raw}")

        # NC-4: Create Folder With Parent From Another Workspace (IDOR)
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, {
            "name": "IDOR Subfolder",
            "parent_id": folderB_id
        })
        if st == 403:
            record_pass("Negative Cases", "Create Folder With Parent From Another Workspace (IDOR)")
        else:
            record_fail("Negative Cases", "Create Folder With Parent From Another Workspace (IDOR)", f"Expected 403, got {st}: {raw}")

        # NC-5: Move Document To Folder In Another Workspace (IDOR)
        if doc2_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/documents/{doc2_id}", token_owner, {
                "title": "Drag Drop Test Note",
                "content": "Moving note content",
                "folder_id": folderB_id,
                "version": 3
            })
            if st == 403:
                record_pass("Negative Cases", "Move Document To Folder In Another Workspace (IDOR)")
            else:
                record_fail("Negative Cases", "Move Document To Folder In Another Workspace (IDOR)", f"Expected 403, got {st}: {raw}")
        else:
            record_fail("Negative Cases", "Move Document To Folder In Another Workspace (IDOR)", "Skipped: doc2_id unavailable")

        # NC-6: Set Index Document From Another Workspace (IDOR)
        if folder_root_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}/index", token_owner, {
                "document_id": docB_id
            })
            if st == 400:
                record_pass("Negative Cases", "Set Index Document From Another Workspace (IDOR)")
            else:
                record_fail("Negative Cases", "Set Index Document From Another Workspace (IDOR)", f"Expected 400, got {st}: {raw}")
        else:
            record_fail("Negative Cases", "Set Index Document From Another Workspace (IDOR)", "Skipped: folder_root_id unavailable")

        # NC-7: Set Soft-Deleted Document as Folder Index
        doc_del_id = run_psql(f"INSERT INTO documents (workspace_id, folder_id, author_id, title, content, is_public, slug, deleted_at) VALUES ('{wsA_id}', '{folder_root_id}', '{u1_id}', 'Deleted Doc', 'content', false, 'del-doc-{ts}', NOW()) RETURNING id;")
        if folder_root_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}/index", token_owner, {
                "document_id": doc_del_id
            })
            if st == 400:
                record_pass("Negative Cases", "Set Soft-Deleted Document as Folder Index")
            else:
                record_fail("Negative Cases", "Set Soft-Deleted Document as Folder Index", f"Expected 400, got {st}: {raw}")
        else:
            record_fail("Negative Cases", "Set Soft-Deleted Document as Folder Index", "Skipped: folder_root_id unavailable")

        # NC-8: Viewer Role Cannot Create Folder (RBAC)
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_viewer, {
            "name": "Viewer Forbidden Folder"
        })
        if st == 403:
            record_pass("Negative Cases", "Viewer Role Cannot Create Folder (RBAC)")
        else:
            record_fail("Negative Cases", "Viewer Role Cannot Create Folder (RBAC)", f"Expected 403, got {st}: {raw}")

        # NC-9: Viewer Role Cannot Move Document (RBAC)
        if doc2_id and folder_root_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/documents/{doc2_id}", token_viewer, {
                "title": "Drag Drop Test Note",
                "folder_id": folder_root_id,
                "version": 3
            })
            if st == 403:
                record_pass("Negative Cases", "Viewer Role Cannot Move Document (RBAC)")
            else:
                record_fail("Negative Cases", "Viewer Role Cannot Move Document (RBAC)", f"Expected 403, got {st}: {raw}")
        else:
            record_fail("Negative Cases", "Viewer Role Cannot Move Document (RBAC)", "Skipped: doc2_id unavailable")

        # NC-10: Viewer Role Cannot Set Folder Index (RBAC)
        if folder_root_id and doc1_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}/index", token_viewer, {
                "document_id": doc1_id
            })
            if st == 403:
                record_pass("Negative Cases", "Viewer Role Cannot Set Folder Index (RBAC)")
            else:
                record_fail("Negative Cases", "Viewer Role Cannot Set Folder Index (RBAC)", f"Expected 403, got {st}: {raw}")
        else:
            record_fail("Negative Cases", "Viewer Role Cannot Set Folder Index (RBAC)", "Skipped: folder or doc unavailable")


        # =========================================================================
        # 3. EDGE CASES SCENARIOS
        # =========================================================================

        # EC-1: Create Folder With Empty JSON Body
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, body={})
        if st == 400:
            record_pass("Edge Cases", "Create Folder With Empty JSON Body")
        else:
            record_fail("Edge Cases", "Create Folder With Empty JSON Body", f"Expected 400, got {st}: {raw}")

        # EC-2: Create Folder With Whitespace-Only Name
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, body={"name": "     "})
        if st == 400:
            record_pass("Edge Cases", "Create Folder With Whitespace-Only Name")
        else:
            record_fail("Edge Cases", "Create Folder With Whitespace-Only Name", f"Expected 400, got {st}: {raw}")

        # EC-3: Create Folder With Non-Existent Parent UUID
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, body={
            "name": "Orphan Folder",
            "parent_id": "00000000-0000-0000-0000-000000000000"
        })
        if st == 403:
            record_pass("Edge Cases", "Create Folder With Non-Existent Parent UUID")
        else:
            record_fail("Edge Cases", "Create Folder With Non-Existent Parent UUID", f"Expected 403, got {st}: {raw}")

        # EC-4: Create Folder With Malformed Parent UUID
        st, body, raw = http_request("POST", f"/api/workspaces/{wsA_id}/folders", token_owner, body={
            "name": "Malformed Parent Folder",
            "parent_id": "not-a-valid-uuid"
        })
        if st == 400:
            record_pass("Edge Cases", "Create Folder With Malformed Parent UUID")
        else:
            record_fail("Edge Cases", "Create Folder With Malformed Parent UUID", f"Expected 400, got {st}: {raw}")

        # EC-5: Create Folder With Malformed Workspace UUID
        st, body, raw = http_request("POST", "/api/workspaces/invalid-workspace-uuid/folders", token_owner, body={
            "name": "Invalid WS Folder"
        })
        if st == 400:
            record_pass("Edge Cases", "Create Folder With Malformed Workspace UUID")
        else:
            record_fail("Edge Cases", "Create Folder With Malformed Workspace UUID", f"Expected 400, got {st}: {raw}")

        # EC-6: Move Document With Malformed Folder UUID
        if doc2_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/documents/{doc2_id}", token_owner, body={
                "title": "Drag Drop Test Note",
                "folder_id": "not-a-valid-uuid",
                "version": 3
            })
            if st == 400:
                record_pass("Edge Cases", "Move Document With Malformed Folder UUID")
            else:
                record_fail("Edge Cases", "Move Document With Malformed Folder UUID", f"Expected 400, got {st}: {raw}")
        else:
            record_fail("Edge Cases", "Move Document With Malformed Folder UUID", "Skipped: doc2_id unavailable")

        # EC-7: Move Document With Non-Existent Folder UUID
        if doc2_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/documents/{doc2_id}", token_owner, body={
                "title": "Drag Drop Test Note",
                "folder_id": "00000000-0000-0000-0000-000000000000",
                "version": 3
            })
            if st == 403:
                record_pass("Edge Cases", "Move Document With Non-Existent Folder UUID")
            else:
                record_fail("Edge Cases", "Move Document With Non-Existent Folder UUID", f"Expected 403, got {st}: {raw}")
        else:
            record_fail("Edge Cases", "Move Document With Non-Existent Folder UUID", "Skipped: doc2_id unavailable")

        # EC-8: Set Folder Index With Malformed Document UUID
        if folder_root_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/folders/{folder_root_id}/index", token_owner, body={
                "document_id": "not-a-valid-uuid"
            })
            if st == 400:
                record_pass("Edge Cases", "Set Folder Index With Malformed Document UUID")
            else:
                record_fail("Edge Cases", "Set Folder Index With Malformed Document UUID", f"Expected 400, got {st}: {raw}")
        else:
            record_fail("Edge Cases", "Set Folder Index With Malformed Document UUID", "Skipped: folder_root_id unavailable")

        # EC-9: Set Folder Index on Non-Existent Folder UUID
        if doc1_id:
            st, body, raw = http_request("PUT", f"/api/workspaces/{wsA_id}/folders/00000000-0000-0000-0000-000000000000/index", token_owner, body={
                "document_id": doc1_id
            })
            if st == 404:
                record_pass("Edge Cases", "Set Folder Index on Non-Existent Folder UUID")
            else:
                record_fail("Edge Cases", "Set Folder Index on Non-Existent Folder UUID", f"Expected 404, got {st}: {raw}")
        else:
            record_fail("Edge Cases", "Set Folder Index on Non-Existent Folder UUID", "Skipped: doc1_id unavailable")

        # EC-10: Get Folder With Non-Existent Folder UUID
        st, body, raw = http_request("GET", f"/api/workspaces/{wsA_id}/folders/00000000-0000-0000-0000-000000000000", token_owner)
        if st == 404:
            record_pass("Edge Cases", "Get Folder With Non-Existent Folder UUID")
        else:
            record_fail("Edge Cases", "Get Folder With Non-Existent Folder UUID", f"Expected 404, got {st}: {raw}")

        # EC-11: Get Folder With Malformed Folder UUID
        st, body, raw = http_request("GET", f"/api/workspaces/{wsA_id}/folders/not-a-valid-uuid", token_owner)
        if st == 400:
            record_pass("Edge Cases", "Get Folder With Malformed Folder UUID")
        else:
            record_fail("Edge Cases", "Get Folder With Malformed Folder UUID", f"Expected 400, got {st}: {raw}")

    finally:
        # --- 4. CLEANUP TEST DATA ---
        try:
            run_psql(f"DELETE FROM workspaces WHERE id IN ('{wsA_id}', '{wsB_id}');")
            run_psql(f"DELETE FROM users WHERE id IN ('{u1_id}', '{u2_id}', '{u3_id}');")
        except Exception as e:
            print(f"Warning: Cleanup failed: {e}", file=sys.stderr)

    # --- 5. PRINT QA-REPORT ---
    print("[QA-REPORT]")
    for status, cat, name, reason in results:
        if status == "PASS":
            print(f"[PASS] {cat} - {name}")
        else:
            print(f"[FAIL] {cat} - {name}")
            print(f"   └─ Reason: {reason}")

if __name__ == "__main__":
    main()

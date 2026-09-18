-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING *;

-- name: CreateProfile :one
INSERT INTO profiles (id, username, full_name, avatar_url, updated_at)
VALUES ($1, $2, $3, $4, NOW())
RETURNING *;

-- name: GetProfileByID :one
SELECT * FROM profiles
WHERE id = $1 LIMIT 1;

-- name: CreateWorkspace :one
INSERT INTO workspaces (id, name, slug, created_by, created_at)
VALUES (gen_random_uuid(), $1, $2, $3, NOW())
RETURNING *;

-- name: GetUserWorkspaces :many
SELECT w.id, w.name, w.slug, wm.role 
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = $1;

-- name: AddWorkspaceMember :exec
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ($1, $2, $3);

-- name: CheckWorkspaceMember :one
SELECT role FROM workspace_members
WHERE workspace_id = $1 AND user_id = $2 LIMIT 1;

-- ==========================================
-- DOMAIN KATEGORI / FOLDERS
-- ==========================================

-- name: CreateFolder :one
INSERT INTO folders (workspace_id, name, parent_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetWorkspaceFolders :many
SELECT * FROM folders
WHERE workspace_id = $1
ORDER BY created_at ASC;

-- name: CheckFolderBelongsToWorkspace :one
SELECT id FROM folders 
WHERE id = $1 AND workspace_id = $2 LIMIT 1;

-- ==========================================
-- DOMAIN DOKUMEN / CATATAN
-- ==========================================

-- name: CreateDocument :one
INSERT INTO documents (workspace_id, folder_id, author_id, title, content, is_public, slug)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetDocumentBySlug :one
-- Cek apakah slug sudah dipakai di workspace (untuk disambiguator slug).
SELECT id FROM documents
WHERE workspace_id = $1 AND slug = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: GetDocument :one
SELECT * FROM documents 
WHERE id = $1 AND workspace_id = $2 LIMIT 1;

-- name: GetWorkspaceDocuments :many
SELECT * FROM documents
WHERE workspace_id = $1 AND deleted_at IS NULL
ORDER BY updated_at DESC;

-- name: UpdateDocument :one
-- Optimistic locking (T-101): hanya update jika version cocok, lalu naikkan version.
-- Slug TIDAK di-update di sini (slug immutable setelah dibuat).
UPDATE documents
SET 
    title = $3,
    content = $4,
    folder_id = $5,
    is_public = $6,
    updated_at = NOW(),
    version = version + 1
WHERE id = $1 AND workspace_id = $2 AND version = $7
RETURNING *;

-- name: SoftDeleteDocument :execrows
UPDATE documents
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND workspace_id = $2;

-- ==========================================
-- RECYCLE BIN & HARD DELETE
-- ==========================================

-- name: GetTrashedDocuments :many
SELECT * FROM documents
WHERE workspace_id = $1 AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- Ganti query Hapus, Restore, dan Update lu menjadi seperti ini:

-- name: RestoreDocument :execrows
UPDATE documents
SET deleted_at = NULL, updated_at = NOW()
WHERE id = $1 AND workspace_id = $2;

-- name: HardDeleteDocument :execrows
DELETE FROM documents
WHERE id = $1 AND workspace_id = $2;

-- name: DeleteFolder :execrows
DELETE FROM folders
WHERE id = $1 AND workspace_id = $2;

-- name: GetFolderWithIndex :one
-- T-105: folder satuan + dokumen indeksnya (README/wiki folder).
-- LEFT JOIN: folder tanpa index TETAP tampil (field index_* bernilai NULL).
-- Index doc yang di-soft-delete dianggap tidak ada (tidak dikembalikan).
SELECT
    f.id, f.workspace_id, f.parent_id, f.name, f.index_document_id,
    f.created_at, f.updated_at,
    d.id AS index_doc_id,
    d.title AS index_doc_title,
    d.slug AS index_doc_slug,
    d.content AS index_doc_content,
    d.updated_at AS index_doc_updated_at
FROM folders f
LEFT JOIN documents d
    ON d.id = f.index_document_id
    AND d.deleted_at IS NULL
WHERE f.id = $1 AND f.workspace_id = $2
LIMIT 1;

-- name: CheckDocumentInWorkspace :one
-- T-105 (validasi setter): dokumen harus milik workspace yang sama & belum dihapus.
SELECT id FROM documents
WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: SetFolderIndexDocument :execrows
-- T-105: pasang/hapus dokumen indeks folder. $3 NULL (valid:false) = hapus index.
UPDATE folders
SET index_document_id = $3, updated_at = NOW()
WHERE id = $1 AND workspace_id = $2;

-- ==========================================
-- GERBANG PUBLIK (Public Share Read-Only)
-- ==========================================

-- name: GetPublicDocumentBySlug :one
-- Endpoint publik: Tanpa JWT, keamanan 100% di level SQL.
-- JOIN ke workspaces untuk resolve workspace_slug dari URL.
-- JOIN ke profiles untuk ambil data author (anti N+1 query).
SELECT 
    d.id, d.title, d.content, d.slug, d.is_public,
    d.created_at, d.updated_at,
    p.username AS author_username, 
    p.full_name AS author_full_name,
    p.avatar_url AS author_avatar_url
FROM documents d
JOIN profiles p ON d.author_id = p.id
JOIN workspaces w ON d.workspace_id = w.id
WHERE w.slug = $1
  AND d.slug = $2
  AND d.is_public = true
  AND d.deleted_at IS NULL
LIMIT 1;
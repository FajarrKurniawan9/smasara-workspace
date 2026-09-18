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
-- T-107: KUNCI READ-ONLY PER DOKUMEN
-- ==========================================

-- name: LockDocument :execrows
-- Kunci dokumen: set locked_by = user_id. Hanya berhasil jika belum dikunci.
UPDATE documents
SET locked_by = $3, updated_at = NOW()
WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL AND locked_by IS NULL;

-- name: UnlockDocument :execrows
-- Lepas kunci dokumen: set locked_by = NULL. Hanya berhasil jika dikunci oleh user yang sama.
UPDATE documents
SET locked_by = NULL, updated_at = NOW()
WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL AND locked_by = $3;

-- name: ForceUnlockDocument :execrows
-- Lepas kunci paksa (oleh OWNER): set locked_by = NULL tanpa peduli siapa pengunci.
UPDATE documents
SET locked_by = NULL, updated_at = NOW()
WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL AND locked_by IS NOT NULL;

-- name: GetDocumentLock :one
-- Ambil status kunci dokumen.
SELECT id, locked_by FROM documents
WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- ==========================================
-- T-108: PENCARIAN PINTAR (Search)
-- ==========================================

-- name: SearchDocuments :many
-- Pencarian full-text: tsvector rank + pg_trgm similarity.
-- Ranking: title bobot lebih tinggi dari content.
-- Hanya dokumen aktif (deleted_at IS NULL) di workspace yang sama.
-- Pengguna yang bukan OWNER hanya melihat dokumen yang bisa diakses via role.
SELECT
    d.id, d.title, d.slug, d.folder_id, d.is_public, d.published_at,
    d.updated_at,
    ts_rank(d.search_vector, to_tsquery('simple', $2)) AS rank,
    similarity(d.title, $2) AS title_sim
FROM documents d
WHERE d.workspace_id = $1
  AND d.deleted_at IS NULL
  AND (
      d.search_vector @@ to_tsquery('simple', $2)
      OR similarity(d.title, $2) > 0.1
  )
ORDER BY
    ts_rank(d.search_vector, to_tsquery('simple', $2)) * 2
    + similarity(d.title, $2) DESC
LIMIT 50;

-- ==========================================
-- T-109: CATATAN TERKAIT (Related Notes)
-- ==========================================

-- name: GetRelatedNotes :many
-- Rekomendasi catatan terkait: explicit [[link]] > sibling folder > trigram judul.
-- $1 = document_id, $2 = workspace_id, $3 = folder_id, $4 = title_for_similarity.
WITH current_doc AS (
    SELECT d.id AS doc_id, d.content FROM documents d WHERE d.id = $1
),
extracted_links AS (
    SELECT DISTINCT unnest(regexp_matches(cd.content, '\[\[([^\]]+)\]\]', 'g')) AS slug
    FROM current_doc cd
),
doc_links AS (
    SELECT DISTINCT d2.id, d2.title, d2.slug, 1.0 AS weight
    FROM documents d2
    JOIN extracted_links el ON el.slug = d2.slug
    WHERE d2.workspace_id = $2
      AND d2.deleted_at IS NULL
      AND d2.id != $1
),
doc_siblings AS (
    SELECT d3.id, d3.title, d3.slug, 0.5 AS weight
    FROM documents d3
    WHERE d3.workspace_id = $2
      AND d3.deleted_at IS NULL
      AND d3.id != $1
      AND d3.folder_id IS NOT DISTINCT FROM $3
      AND d3.id NOT IN (SELECT id FROM doc_links)
),
doc_similar AS (
    SELECT d4.id, d4.title, d4.slug, GREATEST(similarity(d4.title, $4), 0.1) AS weight
    FROM documents d4
    WHERE d4.workspace_id = $2
      AND d4.deleted_at IS NULL
      AND d4.id != $1
      AND d4.id NOT IN (SELECT id FROM doc_links)
      AND d4.id NOT IN (SELECT id FROM doc_siblings)
      AND similarity(d4.title, $4) > 0.05
)
SELECT id, title, slug, weight FROM doc_links
UNION ALL
SELECT id, title, slug, weight FROM doc_siblings
UNION ALL
SELECT id, title, slug, weight FROM doc_similar
ORDER BY weight DESC
LIMIT 10;

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
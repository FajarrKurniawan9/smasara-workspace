CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'OWNER',
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    author_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL DEFAULT 'Untitled Document',
    content TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    slug TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    search_vector tsvector,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE (workspace_id, slug)
);

-- T-102: search_vector di-update otomatis via trigger bawaan Postgres (tsvector_update_trigger).
-- Config 'simple' agar tidak memotong kata (aman untuk campuran Indonesia-Inggris).
CREATE INDEX IF NOT EXISTS documents_search_vector_idx
    ON documents USING GIN (search_vector);

DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents;
CREATE TRIGGER documents_search_vector_trigger
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE PROCEDURE tsvector_update_trigger(search_vector, 'pg_catalog.simple', title, content);

-- T-103: saat dokumen dihapus (soft delete), otomatis set is_public = false.
-- Restore TIDAK mengembalikan status publik (dokumen tetap private).
-- T-104: soft delete juga mengosongkan published_at (invariant: is_public=false => published_at NULL).
CREATE OR REPLACE FUNCTION documents_unpublish_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        NEW.is_public := false;
        NEW.published_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_unpublish_trigger ON documents;
CREATE TRIGGER documents_unpublish_trigger
    BEFORE UPDATE OF deleted_at ON documents
    FOR EACH ROW
    EXECUTE FUNCTION documents_unpublish_on_delete();

-- T-104: published_at di-stempel saat transisi publish, dikosongkan saat unpublish.
-- Pengecekan transisi OLD<->NEW wajib karena UpdateDocument selalu menulis is_public
-- di clause SET (trigger 'UPDATE OF is_public' menyala walau nilai tidak berubah).
CREATE OR REPLACE FUNCTION documents_stamp_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_public THEN
            NEW.published_at := NOW();
        END IF;
    ELSE
        IF OLD.is_public = false AND NEW.is_public = true THEN
            NEW.published_at := NOW();
        ELSIF OLD.is_public = true AND NEW.is_public = false THEN
            NEW.published_at := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_published_at_trigger ON documents;
CREATE TRIGGER documents_published_at_trigger
    BEFORE INSERT OR UPDATE OF is_public ON documents
    FOR EACH ROW
    EXECUTE FUNCTION documents_stamp_published_at();
export interface DocumentItem {
	id: string;
	workspace_id: string;
	folder_id: string | null;
	author_id: string;
	title: string;
	content: string | null;
	is_public: boolean;
	slug: string;
	version: number;
	locked_by: string | null;
	created_at: string;
	updated_at: string;
	published_at: string | null;
	deleted_at: string | null;
}

export type WorkspaceRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface WorkspaceItem {
	id: string;
	name: string;
	slug: string;
	role?: WorkspaceRole;
	created_at?: string;
	updated_at?: string;
}

export interface FolderTreeNode extends FolderItem {
	children: FolderTreeNode[];
}
export interface FolderItem {
	id: string;
	workspace_id: string;
	parent_id: string | null;
	name: string;
	index_document_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface FolderIndexDoc {
	id: string;
	title: string;
	slug: string;
	content: string | null;
	updated_at: string;
}

export interface FolderDetail {
	folder: FolderItem;
	index_document: FolderIndexDoc | null;
}

export interface PublicUserProfile {
	id: string;
	username: string;
	full_name: string;
	avatar_url?: string;
	created_at?: string;
}

export interface PublicDocumentItem {
	id: string;
	title: string;
	slug: string;
	content: string | null;
	is_public: boolean;
	published_at: string | null;
	created_at: string;
	updated_at: string;
	workspace_name: string;
	workspace_slug: string;
	folder_name: string | null;
	author_username: string;
	author_full_name: string;
	author_avatar_url: string;
}

export interface PublicProfileResponse {
	profile: PublicUserProfile;
	documents: PublicDocumentItem[];
}

package handlers

import (
	"errors"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	// Sesuaikan dengan import path package database sqlc Anda
	"github.com/FajarrKurniawan9/smasara-backend/internal/database"
)

type DocumentHandler struct {
	DB *database.Queries
}

func NewDocumentHandler(db *database.Queries) *DocumentHandler {
	return &DocumentHandler{DB: db}
}

// helper untuk parsing string ke pgtype.UUID dengan aman
func parseUUID(id string) (pgtype.UUID, error) {
	var uuid pgtype.UUID
	err := uuid.Scan(id)
	return uuid, err
}

// CreateDocument membuat dokumen baru di dalam workspace/folder
func (h *DocumentHandler) CreateDocument(c *fiber.Ctx) error {
	workspaceIDStr := c.Params("workspace_id")
	
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	// Ambil Author ID dari JWT
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Identitas pengguna tidak ditemukan. Sesi mungkin telah kedaluwarsa.",
		})
	}
	var userUUID pgtype.UUID
	if err := userUUID.Scan(userIDStr); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format ID pengguna tidak valid.",
		})
	}

	// Struct untuk menerima payload dari user
	type CreateDocRequest struct {
		Title    string `json:"title"`
		Content  string `json:"content"`
		FolderID string `json:"folder_id"` // Opsional
		IsPublic bool   `json:"is_public"` // Opsional, default false
	}

	var req CreateDocRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal parsing request body"})
	}

	// --- 🛡️ VALIDASI BACKEND (ERROR HANDLING) ---
	// Bersihkan spasi kosong di awal dan akhir string
	cleanTitle := strings.TrimSpace(req.Title)
	
	// Jika setelah dibersihkan ternyata kosong, tolak request-nya!
	if cleanTitle == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Judul dokumen tidak boleh kosong",
		})
	}
	// ----------------------------------------------

	// Menangani folder_id yang opsional (Nullable UUID)
	var folderUUID pgtype.UUID
	if req.FolderID != "" {
		if err := folderUUID.Scan(req.FolderID); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format folder_id tidak valid"})
		}
	}

	if req.FolderID != "" {
		_, err := h.DB.CheckFolderBelongsToWorkspace(c.Context(), database.CheckFolderBelongsToWorkspaceParams{
			ID:          folderUUID,
			WorkspaceID: workspaceUUID, // pastikan lu udah menangkap workspaceUUID dari URL di atasnya
		})
		if err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Folder tujuan tidak valid atau bukan milik workspace ini",
			})
		}
	}

	// Generate slug unik dalam workspace (dari judul + disambiguator otomatis)
	slug, err := h.uniqueSlug(c.Context(), workspaceUUID, cleanTitle)
	if err != nil {
		log.Printf("Error generating slug: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal membuat slug dokumen"})
	}

	// Eksekusi ke database via sqlc
	doc, err := h.DB.CreateDocument(c.Context(), database.CreateDocumentParams{
		WorkspaceID: workspaceUUID,
		FolderID:    folderUUID,
		AuthorID:    userUUID, 
		Title:       cleanTitle, // <-- Gunakan cleanTitle yang sudah divalidasi
		Content:     pgtype.Text{String: req.Content, Valid: true}, 
		IsPublic:    req.IsPublic,
		Slug:        slug,
	})
	if err != nil {
		log.Printf("Error creating document: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal membuat dokumen"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":  "Dokumen berhasil dibuat",
		"document": doc,
	})
}

// UpdateDocument memperbarui judul, isi, folder, dan status publik dokumen
func (h *DocumentHandler) UpdateDocument(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	// 1. Tangkap workspace_id dari URL (UNTUK MENCEGAH IDOR)
	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	type UpdateDocRequest struct {
		Title    string `json:"title"`
		Content  string `json:"content"`
		FolderID string `json:"folder_id"`
		IsPublic bool   `json:"is_public"`
		Version  int32  `json:"version"` // versi yang dimiliki client (optimistic locking)
	}

	var req UpdateDocRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Gagal parsing request body"})
	}

	// Validasi anti-spasi kosong
	cleanTitle := strings.TrimSpace(req.Title)
	if cleanTitle == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Judul dokumen tidak boleh kosong"})
	}

	var folderUUID pgtype.UUID
	if req.FolderID != "" {
		if err := folderUUID.Scan(req.FolderID); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format folder_id tidak valid"})
		}
	}

	if req.FolderID != "" {
		_, err := h.DB.CheckFolderBelongsToWorkspace(c.Context(), database.CheckFolderBelongsToWorkspaceParams{
			ID:          folderUUID,
			WorkspaceID: workspaceUUID, // pastikan lu udah menangkap workspaceUUID dari URL di atasnya
		})
		if err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Folder tujuan tidak valid atau bukan milik workspace ini",
			})
		}
	}

	// 2. Eksekusi DB dengan mengirim WorkspaceID & Version (optimistic locking)
	doc, err := h.DB.UpdateDocument(c.Context(), database.UpdateDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID, // <-- TAMBENG PERTAHANAN KITA
		Title:       cleanTitle,
		Content:     pgtype.Text{String: req.Content, Valid: true}, 
		FolderID:    folderUUID, 
		IsPublic:    req.IsPublic, 
		Version:     req.Version,
	})
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Tidak ada baris yang cocok: bisa 404 (dokumen hilang) atau 409 (versi bentrok).
			// Bedakan dengan mengecek keberadaan dokumen.
			_, checkErr := h.DB.GetDocument(c.Context(), database.GetDocumentParams{
				ID:          docUUID,
				WorkspaceID: workspaceUUID,
			})
			if checkErr != nil {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "Dokumen tidak ditemukan atau Anda tidak memiliki akses",
				})
			}
			// Dokumen ada, tapi versi sudah berubah -> konflik edit.
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "Dokumen sudah diubah oleh pengguna lain. Muat ulang versi terbaru lalu coba lagi.",
			})
		}
		log.Printf("Error updating document: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memperbarui dokumen"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":  "Dokumen berhasil diperbarui",
		"document": doc,
	})
}

// SoftDeleteDocument menghapus dokumen secara logika (set deleted_at)
func (h *DocumentHandler) SoftDeleteDocument(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	// 1. Tangkap workspace_id dari URL (Mencegah IDOR)
	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	// 2. Eksekusi DB dengan menangkap 2 variabel (rows, err) dan mengirim Struct (Params)
	rows, err := h.DB.SoftDeleteDocument(c.Context(), database.SoftDeleteDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus dokumen"})
	}

	// 3. Pengecekan jika dokumen tidak ada atau beda workspace
	if rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Dokumen tidak ditemukan atau Anda tidak memiliki akses",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Dokumen berhasil dipindahkan ke Recycle Bin",
	})
}

// GetDocument mengambil detail satu dokumen
func (h *DocumentHandler) GetDocument(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	workspaceIDStr := c.Params("workspace_id")
	// 🛡️ UBAH _ (Underscore) menjadi err, LALU TANGKAP ERROR-NYA
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	doc, err := h.DB.GetDocument(c.Context(), database.GetDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dokumen tidak ditemukan atau Anda tidak memiliki akses"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"document": doc,
	})
}

// GetWorkspaceDocuments mengambil semua dokumen di sebuah workspace
func (h *DocumentHandler) GetWorkspaceDocuments(c *fiber.Ctx) error {
	workspaceIDStr := c.Params("workspace_id")
	
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	docs, err := h.DB.GetWorkspaceDocuments(c.Context(), workspaceUUID)
	if err != nil {
		log.Printf("Error fetching documents: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengambil daftar dokumen"})
	}

	// Jika tidak ada data, kembalikan array kosong agar rapi di frontend
	if docs == nil {
		docs = []database.Document{} 
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"documents": docs,
	})
}

// GetTrashedDocuments mengambil semua dokumen di Recycle Bin
func (h *DocumentHandler) GetTrashedDocuments(c *fiber.Ctx) error {
	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	docs, err := h.DB.GetTrashedDocuments(c.Context(), workspaceUUID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengambil data dari Recycle Bin"})
	}

	if docs == nil {
		docs = []database.Document{}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"documents": docs,
	})
}

// RestoreDocument mengembalikan dokumen dari Recycle Bin
func (h *DocumentHandler) RestoreDocument(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	// 1. Tangkap workspace_id dari URL
	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	rows, err := h.DB.RestoreDocument(c.Context(), database.RestoreDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal merestore dokumen"})
	}

	// Trik Logika Baru: Kalau tidak ada data yang diubah, berarti gagal (Not Found)
	if rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dokumen tidak ditemukan atau Anda tidak memiliki akses"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Dokumen berhasil dipulihkan dari Recycle Bin",
	})
}

// HardDeleteDocument menghapus dokumen secara permanen
func (h *DocumentHandler) HardDeleteDocument(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	// 1. Tangkap workspace_id dari URL
	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	// 2. Kirim menggunakan Struct Params hasil generate sqlc
	rows, err := h.DB.HardDeleteDocument(c.Context(), database.HardDeleteDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus dokumen secara permanen"})
	}

	// Logika anti pembohong:
	if rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dokumen tidak ditemukan atau Anda tidak memiliki akses"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Dokumen berhasil dihapus permanen",
	})
}

// ==========================================
// T-107: KUNCI READ-ONLY PER DOKUMEN
// ==========================================

// LockDocument mengunci dokumen agar hanya pemegang kunci / OWNER yang bisa mengedit.
func (h *DocumentHandler) LockDocument(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Identitas pengguna tidak ditemukan"})
	}
	var userUUID pgtype.UUID
	if err := userUUID.Scan(userIDStr); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format ID pengguna tidak valid"})
	}

	rows, err := h.DB.LockDocument(c.Context(), database.LockDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
		LockedBy:    userUUID,
	})
	if err != nil {
		log.Printf("Error locking document: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengunci dokumen"})
	}

	if rows == 0 {
		// Cek apakah dokumen ada
		_, checkErr := h.DB.GetDocument(c.Context(), database.GetDocumentParams{
			ID:          docUUID,
			WorkspaceID: workspaceUUID,
		})
		if checkErr != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dokumen tidak ditemukan atau Anda tidak memiliki akses"})
		}
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Dokumen sudah dikunci oleh pengguna lain"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Dokumen berhasil dikunci",
	})
}

// UnlockDocument melepaskan kunci dokumen (oleh pemegang kunci).
func (h *DocumentHandler) UnlockDocument(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Identitas pengguna tidak ditemukan"})
	}
	var userUUID pgtype.UUID
	if err := userUUID.Scan(userIDStr); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format ID pengguna tidak valid"})
	}

	// Coba lepas kunci sebagai pemegang kunci
	rows, err := h.DB.UnlockDocument(c.Context(), database.UnlockDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
		LockedBy:    userUUID,
	})
	if err != nil {
		log.Printf("Error unlocking document: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal melepaskan kunci dokumen"})
	}

	if rows == 0 {
		// Coba force unlock (hanya OWNER)
		role, _ := c.Locals("workspace_role").(pgtype.Text)
		if !role.Valid || role.String != "OWNER" {
			// Cek apakah dokumen ada
			_, checkErr := h.DB.GetDocument(c.Context(), database.GetDocumentParams{
				ID:          docUUID,
				WorkspaceID: workspaceUUID,
			})
			if checkErr != nil {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dokumen tidak ditemukan"})
			}
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Hanya pemegang kunci atau Owner yang bisa melepaskan kunci"})
		}

		// Force unlock (OWNER)
		_, err = h.DB.ForceUnlockDocument(c.Context(), database.ForceUnlockDocumentParams{
			ID:          docUUID,
			WorkspaceID: workspaceUUID,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal melepaskan kunci dokumen"})
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Kunci dokumen berhasil dilepaskan",
	})
}

// ==========================================
// T-108: PENCARIAN PINTAR (Search)
// ==========================================

// SearchDocuments mencari dokumen dalam workspace menggunakan full-text search + pg_trgm.
func (h *DocumentHandler) SearchDocuments(c *fiber.Ctx) error {
	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	query := c.Query("q")
	if strings.TrimSpace(query) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Parameter q tidak boleh kosong"})
	}

	// Konversi query user ke tsquery format.
	// Pisahkan kata, gabungkan dengan & (AND) untuk presisi.
	words := strings.Fields(strings.TrimSpace(query))
	tsquery := strings.Join(words, " & ")

	docs, err := h.DB.SearchDocuments(c.Context(), database.SearchDocumentsParams{
		WorkspaceID: workspaceUUID,
		ToTsquery:   tsquery,
	})
	if err != nil {
		log.Printf("Error searching documents: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal melakukan pencarian"})
	}

	if docs == nil {
		docs = []database.SearchDocumentsRow{}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"query":     query,
		"results":   docs,
		"total":     len(docs),
	})
}

// ==========================================
// T-109: CATATAN TERKAIT (Related Notes)
// ==========================================

// GetRelatedNotes mengembalikan daftar catatan terkait dengan skor tertimbang.
func (h *DocumentHandler) GetRelatedNotes(c *fiber.Ctx) error {
	docIDStr := c.Params("document_id")
	docUUID, err := parseUUID(docIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format document_id tidak valid"})
	}

	workspaceIDStr := c.Params("workspace_id")
	workspaceUUID, err := parseUUID(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format workspace_id tidak valid"})
	}

	// Ambil dokumen untuk folder_id dan title (digunakan sebagai parameter query)
	doc, err := h.DB.GetDocument(c.Context(), database.GetDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dokumen tidak ditemukan"})
	}

	notes, err := h.DB.GetRelatedNotes(c.Context(), database.GetRelatedNotesParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID,
		FolderID:    doc.FolderID,
		Similarity:  doc.Title,
	})
	if err != nil {
		log.Printf("Error getting related notes: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mengambil catatan terkait"})
	}

	if notes == nil {
		notes = []database.GetRelatedNotesRow{}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"document_id": docIDStr,
		"related":     notes,
		"total":       len(notes),
	})
}
package handlers

import (
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
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

	// Eksekusi ke database via sqlc
	doc, err := h.DB.CreateDocument(c.Context(), database.CreateDocumentParams{
		WorkspaceID: workspaceUUID,
		FolderID:    folderUUID,
		AuthorID:    userUUID, 
		Title:       cleanTitle, // <-- Gunakan cleanTitle yang sudah divalidasi
		Content:     pgtype.Text{String: req.Content, Valid: true}, 
		IsPublic:    req.IsPublic,
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

	// 2. Eksekusi DB dengan mengirim WorkspaceID juga
	doc, err := h.DB.UpdateDocument(c.Context(), database.UpdateDocumentParams{
		ID:          docUUID,
		WorkspaceID: workspaceUUID, // <-- TAMBENG PERTAHANAN KITA
		Title:       cleanTitle,
		Content:     pgtype.Text{String: req.Content, Valid: true}, 
		FolderID:    folderUUID, 
		IsPublic:    req.IsPublic, 
	})
	
	if err != nil {
		// Jika dokumen tidak ditemukan atau bukan milik workspace ini,
		// sqlc (:one) otomatis mengirim error "no rows in result set"
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Dokumen tidak ditemukan atau Anda tidak memiliki akses",
		})
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
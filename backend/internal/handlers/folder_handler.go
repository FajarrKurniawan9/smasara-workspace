package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/FajarrKurniawan9/smasara-backend/internal/database"
)

type FolderHandler struct {
	DB *database.Queries
}

func NewFolderHandler(db *database.Queries) *FolderHandler {
	return &FolderHandler{DB: db}
}

// CreateFolderRequest adalah struktur JSON yang diekspektasikan dari Frontend
type CreateFolderRequest struct {
	Name     string `json:"name"`
	ParentID string `json:"parent_id"` // Opsional
}

// CreateFolder memproses pembuatan kategori/folder baru di dalam workspace
func (h *FolderHandler) CreateFolder(c *fiber.Ctx) error {
	// 1. Tangkap dan Validasi Workspace ID dari URL (/workspaces/:workspace_id/folders)
	workspaceParam := c.Params("workspace_id")
	var workspaceID pgtype.UUID
	
	// Scan berfungsi mengonversi string menjadi format pgtype.UUID
	if err := workspaceID.Scan(workspaceParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format workspace_id pada URL tidak valid",
		})
	}

	// 2. Parsing Body JSON dari Request
	var req CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format JSON tidak valid",
		})
	}

	// 3. Validasi Input Ketat Backend (Anti Spasi Kosong)
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Nama folder tidak boleh kosong",
		})
	}

	// 4. Proses Parent ID (Jika dikirim oleh user untuk nested folder)
	var parentID pgtype.UUID
	if req.ParentID != "" {
		if err := parentID.Scan(req.ParentID); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Format parent_id tidak valid",
			})
		}
	}

	if req.ParentID != "" {
		_, err := h.DB.CheckFolderBelongsToWorkspace(c.Context(), database.CheckFolderBelongsToWorkspaceParams{
			ID:          parentID,
			WorkspaceID: workspaceID,
		})
		if err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Folder induk tidak valid atau bukan milik workspace ini",
			})
		}
	}
	
	// 5. Eksekusi ke Database melalui sqlc struct
	folder, err := h.DB.CreateFolder(c.Context(), database.CreateFolderParams{
		WorkspaceID: workspaceID,
		Name:        req.Name,
		ParentID:    parentID,
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal menyimpan folder ke database",
		})
	}

	// 6. Kembalikan Response Sukses
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Folder berhasil dibuat",
		"data":    folder,
	})
}

// GetWorkspaceFolders mengambil seluruh hierarki folder di dalam sebuah workspace
func (h *FolderHandler) GetWorkspaceFolders(c *fiber.Ctx) error {
	// 1. Ambil dan Validasi Workspace ID dari URL
	workspaceParam := c.Params("workspace_id")
	var workspaceID pgtype.UUID
	
	if err := workspaceID.Scan(workspaceParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format workspace_id pada URL tidak valid",
		})
	}

	// 2. Tarik Data dari Database menggunakan fungsi yang di-generate sqlc
	folders, err := h.DB.GetWorkspaceFolders(c.Context(), workspaceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Terjadi kesalahan saat mengambil data folder",
		})
	}

	// 3. Best Practice API: Pastikan mengembalikan array kosong "[]" 
	// daripada "null" jika workspace tersebut belum punya folder sama sekali
	if folders == nil {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "Belum ada folder di workspace ini",
			"data":    []interface{}{}, 
		})
	}

	// 4. Kembalikan Response Sukses
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Berhasil mengambil daftar folder",
		"data":    folders,
	})
}

// DeleteFolder menghapus folder beserta seluruh dokumen di dalamnya (Cascading Delete)
func (h *FolderHandler) DeleteFolder(c *fiber.Ctx) error {
	folderParam := c.Params("folder_id")
	var folderID pgtype.UUID
	
	if err := folderID.Scan(folderParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format folder_id pada URL tidak valid",
		})
	}

	// 1. Tangkap workspace_id dari URL
	workspaceParam := c.Params("workspace_id")
	var workspaceID pgtype.UUID
	if err := workspaceID.Scan(workspaceParam); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format workspace_id pada URL tidak valid",
		})
	}

	// 2. Eksekusi Hard Delete menggunakan struct params (Mencegah IDOR)
	rows, err := h.DB.DeleteFolder(c.Context(), database.DeleteFolderParams{
		ID:          folderID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menghapus folder"})
	}

	if rows == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Folder tidak ditemukan atau Anda tidak memiliki akses"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Folder dan seluruh isi dokumen di dalamnya berhasil dihapus permanen",
	})
}
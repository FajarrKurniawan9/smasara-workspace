package handlers

import (
	"context"
	"strings"

	"github.com/FajarrKurniawan9/smasara-backend/internal/database" // Sesuaikan dengan module lu

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
)

type WorkspaceHandler struct {
	DB *database.Queries
}

func (h *WorkspaceHandler) CreateWorkspace(c *fiber.Ctx) error {
	// 1. Ambil ID user dari JWT (Titipan Satpam)
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Identitas JWT tidak terbaca"})
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userIDStr); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format ID User tidak valid"})
	}

	// 2. Tangkap & Validasi Sinyal (Data dari client)
	type WorkspaceRequest struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}

	var req WorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format JSON tidak valid"})
	}

	// Validasi anti-spasi kosong
	cleanName := strings.TrimSpace(req.Name)
	cleanSlug := strings.TrimSpace(req.Slug)

	if cleanName == "" || cleanSlug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nama Workspace dan Slug tidak boleh kosong"})
	}

	// 3. Proses Aksi 1: Bikin Workspace di DB
	workspace, err := h.DB.CreateWorkspace(context.Background(), database.CreateWorkspaceParams{
		Name:      cleanName,
		Slug:      cleanSlug,
		CreatedBy: userUUID,
	})

	if err != nil {
		// Biasanya error di sini karena 'Slug' yang dikirim sudah pernah dipakai orang lain (UNIQUE constraint)
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Gagal membuat workspace. Kemungkinan URL Slug sudah dipakai.",
		})
	}

	// 4. Proses Aksi 2: Jadikan User sebagai OWNER di Workspace tersebut
	err = h.DB.AddWorkspaceMember(context.Background(), database.AddWorkspaceMemberParams{
		WorkspaceID: workspace.ID,
		UserID:      userUUID,
		// Kita set explicitly jadi OWNER. Tipe data menggunakan pgtype.Text karena di DB kita set bisa nullable/default.
		Role:        pgtype.Text{String: "OWNER", Valid: true}, 
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Workspace berhasil dibuat, tapi gagal menetapkan hak akses (Owner)",
		})
	}

	// 5. Kembalikan Sinyal Sukses
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":   "Workspace berhasil dibangun dan lu resmi jadi Owner!",
		"workspace": workspace,
	})
}
// GetUserWorkspaces mengambil daftar workspace di mana user tersebut terdaftar
func (h *WorkspaceHandler) GetUserWorkspaces(c *fiber.Ctx) error {
	// 1. Ambil ID user dari JWT (Titipan Satpam)
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Identitas JWT tidak terbaca"})
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userIDStr); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format ID User tidak valid"})
	}

	// 2. Proses: Tarik data dari Database via sqlc
	workspaces, err := h.DB.GetUserWorkspaces(context.Background(), userUUID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal mengambil daftar workspace dari database",
		})
	}

	// 3. (Praktik Terbaik Industri) Pastikan kembalian berupa array kosong [], bukan null, jika user belum punya workspace
	if workspaces == nil {
		workspaces = []database.GetUserWorkspacesRow{}
	}

	// 4. Kembalikan Sinyal Sukses beserta datanya
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":    "Berhasil memuat daftar workspace",
		"workspaces": workspaces,
	})
}
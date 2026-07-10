package handlers

import (
	"context"
	"strings" // <--- Tambahan import untuk memanipulasi teks

	"github.com/FajarrKurniawan9/smasara-backend/internal/database" // Ingat: Sesuaikan dengan nama module lu
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
)

type ProfileHandler struct {
	DB *database.Queries
}

// CreateProfile memproses pembuatan profil setelah user berhasil login
func (h *ProfileHandler) CreateProfile(c *fiber.Ctx) error {
	// 1. Ambil user_id dari JWT
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Identitas pengguna tidak ditemukan. Sesi mungkin telah kedaluwarsa.",
		})
	}

	// 2. Ubah string ID menjadi tipe UUID murni
	var userUUID pgtype.UUID
	if err := userUUID.Scan(userIDStr); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Format ID pengguna tidak valid.",
		})
	}

	// 3. Tangkap Sinyal (Data dari client)
	type ProfileRequest struct {
		Username  string `json:"username"`
		FullName  string `json:"full_name"`
		AvatarUrl string `json:"avatar_url"`
	}

	var req ProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format JSON tidak valid"})
	}

	// --- VALIDASI BACKEND (TAMBALAN CELAH) ---
	// Bersihkan spasi di awal dan akhir input. Kalau sisa teksnya kosong, berarti invalid!
	cleanUsername := strings.TrimSpace(req.Username)
	cleanFullName := strings.TrimSpace(req.FullName)

	if cleanUsername == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username tidak boleh kosong atau hanya berisi spasi"})
	}
	
	// Bonus: Kita pastikan username nggak terlalu pendek
	if len(cleanUsername) < 3 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username minimal harus 3 karakter"})
	}

	if cleanFullName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Full Name tidak boleh kosong"})
	}
	// ----------------------------------------------

	// Tangani data opsional (AvatarUrl) menjadi Nullable Text
	avatar := pgtype.Text{String: req.AvatarUrl, Valid: req.AvatarUrl != ""}

	// 4. Proses (Lempar ke Database) menggunakan data yang sudah divalidasi (clean)
	profile, err := h.DB.CreateProfile(context.Background(), database.CreateProfileParams{
		ID:        userUUID,
		Username:  cleanUsername, // Gunakan yang sudah bersih dari spasi berlebih
		FullName:  cleanFullName, // Gunakan yang sudah bersih dari spasi berlebih
		AvatarUrl: avatar,
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Gagal menyimpan profil. Kemungkinan username sudah dipakai.",
		})
	}

	// 5. Kembalikan Sinyal Sukses
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Profil berhasil dibuat!",
		"profile": profile,
	})
}
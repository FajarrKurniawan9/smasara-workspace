package handlers

import (
	// Catatan: Ubah "smasara" dengan nama module di go.mod lu
	"context"
	"os"
	"strings"
	"time"

	"github.com/FajarrKurniawan9/smasara-backend/internal/database"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler mengatur injeksi dependensi untuk database
type AuthHandler struct {
	DB *database.Queries
}

// Register adalah fungsi untuk memproses sinyal pendaftaran
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	type RegisterRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format JSON tidak valid"})
	}

	// 🛡️ VALIDASI KETAT ANTI-HANTU
	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	cleanPassword := strings.TrimSpace(req.Password)

	if cleanEmail == "" || cleanPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email dan Password tidak boleh kosong"})
	}
	if len(cleanPassword) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Password harus memiliki minimal 6 karakter"})
	}

	// Enkripsi Password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(cleanPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memproses keamanan password"})
	}

	// Simpan ke DB (Gunakan cleanEmail)
	user, err := h.DB.CreateUser(context.Background(), database.CreateUserParams{
		Email:        cleanEmail,
		PasswordHash: string(hashedPassword),
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal mendaftarkan user. Email mungkin sudah dipakai."})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "User berhasil dibuat",
		"user_id": user.ID,
	})
}

// Login: Memproses sinyal masuk dan meracik JWT
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	type LoginRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format JSON tidak valid"})
	}

	// 🛡️ SAMAKAN FORMAT DENGAN REGISTER
	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	cleanPassword := strings.TrimSpace(req.Password)

	user, err := h.DB.GetUserByEmail(context.Background(), cleanEmail)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Kredensial tidak valid"})
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(cleanPassword))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Kredensial tidak valid"})
	}

	// Pembuatan JWT...
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	})

	secretKey := os.Getenv("JWT_SECRET")
	if secretKey == "" {
		secretKey = "smasara-knowledge-vault-secret"
	}

	t, err := token.SignedString([]byte(secretKey))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menerbitkan token akses"})
	}

	// 5. Tanamkan Token ke dalam HTTP-Only Cookie (Brankas Baja)
	c.Cookie(&fiber.Cookie{
		Name:     "jwt_smasara",
		Value:    t,
		Expires:  time.Now().Add(72 * time.Hour), // Sesuai dengan masa berlaku token
		HTTPOnly: true,                           // Anti-XSS (Mustahil dibaca JavaScript)
		SameSite: "Lax",                          // Anti-CSRF (Gunakan "Lax" untuk dev lokal)
		// Secure: true,                         // TODO: Aktifkan (uncomment) saat Production dengan HTTPS
	})

	// 6. Dikembalikan (Response sukses TANPA mengirim token di JSON body)
	return c.JSON(fiber.Map{
		"message": "Login berhasil",
	})
}

// Logout: Wajib dibuat karena Frontend tidak bisa menghapus HTTP-Only Cookie
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "jwt_smasara",
		Value:    "",                             // Kosongkan nilai
		Expires:  time.Now().Add(-1 * time.Hour), // Paksa kedaluwarsa ke masa lalu
		HTTPOnly: true,
		SameSite: "Lax",
	})

	return c.JSON(fiber.Map{
		"message": "Logout berhasil",
	})
}
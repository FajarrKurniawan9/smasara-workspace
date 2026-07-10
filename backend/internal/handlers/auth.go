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

	return c.JSON(fiber.Map{
		"message": "Login berhasil",
		"token":   t,
	})
}
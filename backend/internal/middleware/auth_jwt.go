package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Protected adalah middleware untuk memastikan hanya user dengan JWT valid yang bisa lewat
func Protected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 1. Ambil token dari header "Authorization"
		authHeader := c.Get("Authorization")
		
		// Pastikan formatnya "Bearer <token>"
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Akses ditolak: Token tidak ditemukan atau format salah",
			})
		}

		// 2. Potong kata "Bearer " untuk mendapatkan token murninya
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		
		// Ambil kunci rahasia yang sama dengan yang kita pakai saat Login
		secretKey := os.Getenv("JWT_SECRET")
		if secretKey == "" {
			secretKey = "smasara-knowledge-vault-secret"
		}

		// 3. Validasi keaslian token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Pastikan algoritma enkripsinya sesuai
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.ErrUnauthorized
			}
			return []byte(secretKey), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Akses ditolak: Token tidak valid atau sudah kedaluwarsa",
			})
		}

		// 4. Ekstrak data (Claims) dari dalam token
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Akses ditolak: Klaim token rusak",
			})
		}

		// 5. Simpan user_id ke dalam context Fiber
		// Ini SANGAT PENTING agar handler selanjutnya tahu siapa user yang sedang me-request
		c.Locals("user_id", claims["user_id"])

		// 6. Loloskan request ke proses selanjutnya
		return c.Next()
	}
}
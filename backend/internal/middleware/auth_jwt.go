package middleware

import (
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Protected adalah middleware untuk memastikan hanya user dengan JWT valid yang bisa lewat
func Protected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 1. Ambil token dari HTTP-Only Cookie (Brankas Baja)
		tokenString := c.Cookies("jwt_smasara")

		// Jika cookie tidak ditemukan atau kosong, tolak akses
		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Akses ditolak: Sesi telah berakhir atau Anda belum login",
			})
		}

		// Ambil kunci rahasia (harus sama persis dengan yang di auth.go)
		secretKey := os.Getenv("JWT_SECRET")
		if secretKey == "" {
			secretKey = "smasara-knowledge-vault-secret"
		}

		// 2. Validasi keaslian token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Pastikan algoritma enkripsinya HMAC
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.ErrUnauthorized
			}
			return []byte(secretKey), nil
		})

		// Jika proses parsing error atau token kedaluwarsa
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Akses ditolak: Token tidak valid atau sudah kedaluwarsa",
			})
		}

		// 3. Ekstrak data (Claims) dari dalam token
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Akses ditolak: Klaim token rusak",
			})
		}

		// 4. Simpan user_id ke dalam context Fiber untuk handler selanjutnya
		c.Locals("user_id", claims["user_id"])

		// 5. Loloskan request
		return c.Next()
	}
}
package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/FajarrKurniawan9/smasara-backend/internal/database"
)

// RequireWorkspaceAccess memvalidasi apakah user (dari JWT) adalah member dari workspace (dari URL)
func RequireWorkspaceAccess(db *database.Queries) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 1. Ambil user_id hasil ekstraksi JWT Middleware sebelumnya
		userIDString, ok := c.Locals("user_id").(string)
		if !ok || userIDString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized: user_id tidak ditemukan atau token tidak valid",
			})
		}

		var userID pgtype.UUID
		if err := userID.Scan(userIDString); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized: Format ID pengguna tidak valid",
			})
		}

		// 2. Ambil workspace_id dari parameter URL (/api/workspaces/:workspace_id/...)
		workspaceParam := c.Params("workspace_id")
		if workspaceParam == "" {
			// Jika rute tidak memiliki parameter ini, abaikan pengecekan (lolos ke handler selanjutnya)
			return c.Next()
		}

		var workspaceID pgtype.UUID
		if err := workspaceID.Scan(workspaceParam); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Bad Request: Format workspace_id pada URL tidak valid",
			})
		}

		// 3. Cek Database: Apakah user ini terdaftar di workspace_members?
		role, err := db.CheckWorkspaceMember(c.Context(), database.CheckWorkspaceMemberParams{
			WorkspaceID: workspaceID,
			UserID:      userID,
		})

		if err != nil {
			// Jika sql.ErrNoRows, berarti dia bukan member. Blokir!
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Forbidden: Anda tidak memiliki akses ke Workspace ini",
			})
		}

		// 4. (Bonus Arsitektur) Simpan Role-nya ke dalam Context. 
		// Nanti di Handler, lu bisa ngecek: "Oh, dia EDITOR, jadi boleh bikin folder. Kalau VIEWER ngga boleh."
		c.Locals("workspace_role", role)

		// 5. Lolos pemeriksaan, silakan lanjut ke Handler utama (CreateFolder)!
		return c.Next()
	}
}
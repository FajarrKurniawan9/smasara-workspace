package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/FajarrKurniawan9/smasara-backend/internal/database"
)

// RequireDocumentNotLocked memblokir user jika dokumen terkunci dan bukan pemilik kunci / OWNER.
// Harus dipanggil SETELAH RequireWorkspaceAccess (agar workspace_role + user_id tersedia).
// Membaca document_id dari URL parameter :document_id.
func RequireDocumentNotLocked(db *database.Queries) fiber.Handler {
	return func(c *fiber.Ctx) error {
		docIDStr := c.Params("document_id")
		if docIDStr == "" {
			return c.Next() // rute tanpa document_id, lewati
		}

		var docID pgtype.UUID
		if err := docID.Scan(docIDStr); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Format document_id tidak valid",
			})
		}

		workspaceIDStr := c.Params("workspace_id")
		var workspaceID pgtype.UUID
		if err := workspaceID.Scan(workspaceIDStr); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Format workspace_id tidak valid",
			})
		}

		lock, err := db.GetDocumentLock(c.Context(), database.GetDocumentLockParams{
			ID:          docID,
			WorkspaceID: workspaceID,
		})
		if err != nil {
			// Dokumen tidak ditemukan — biarkan handler yang handle 404
			return c.Next()
		}

		// Jika tidak terkunci, lolos
		if !lock.LockedBy.Valid {
			return c.Next()
		}

		// Ambil user_id dan role
		userIDStr, _ := c.Locals("user_id").(string)
		var userID pgtype.UUID
		_ = userID.Scan(userIDStr)

		role, _ := c.Locals("workspace_role").(pgtype.Text)

		// Pemilik kunci bisa edit
		if lock.LockedBy == userID {
			return c.Next()
		}

		// OWNER bisa edit meskipun dokumen dikunci
		if role.Valid && role.String == "OWNER" {
			return c.Next()
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Dokumen sedang dikunci oleh pengguna lain. Anda tidak bisa mengedit dokumen ini.",
		})
	}
}

package handlers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/FajarrKurniawan9/smasara-backend/internal/database"
)

// slugify mengubah judul menjadi slug URL yang valid:
// lowercase, hanya huruf ASCII & angka, sisanya jadi '-', ujung-ujung dipangkas.
// Judul yang hasilnya kosong (mis. semua emoji) fallback ke "untitled".
func slugify(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	var b strings.Builder
	lastHyphen := false
	for _, r := range s {
		isAlnum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlnum {
			b.WriteRune(r)
			lastHyphen = false
		} else if !lastHyphen && b.Len() > 0 {
			b.WriteByte('-')
			lastHyphen = true
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		slug = "untitled"
	}
	return slug
}

// uniqueSlug menghasilkan slug yang unik di dalam workspace.
// Kalau slug dasar sudah dipakai, otomatis disambung -2, -3, dst.
func (h *DocumentHandler) uniqueSlug(ctx context.Context, workspaceID pgtype.UUID, title string) (string, error) {
	base := slugify(title)
	slug := base
	for i := 2; ; i++ {
		_, err := h.DB.GetDocumentBySlug(ctx, database.GetDocumentBySlugParams{
			WorkspaceID: workspaceID,
			Slug:        slug,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return slug, nil // belum dipakai
			}
			return "", fmt.Errorf("gagal cek ketersediaan slug: %w", err)
		}
		// Tabrakan -> coba suffix berikutnya.
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}

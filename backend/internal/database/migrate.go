package database

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

// migrationsFS berisi semua file SQL migrasi yang di-embed langsung ke binary.
// File dibaca & dijalankan berurutan (urut nama) saat aplikasi start.
//
//go:embed migrations/*.sql
var migrationsFS embed.FS

// RunMigrations menerapkan migrasi yang belum jalan (di-track di tabel schema_migrations).
// Aman dijalankan berulang: tiap migrasi idempoten (IF NOT EXISTS).
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	// 1. Pastikan tabel pelacak migrasi ada.
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		return fmt.Errorf("gagal membuat tabel schema_migrations: %w", err)
	}

	// 2. Kumpulkan nama file migrasi, urutkan (0001 < 0002 < ...).
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("gagal membaca folder migrasi: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	// 3. Terapkan tiap migrasi yang belum tercatat.
	for _, name := range names {
		var applied bool
		err := pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, name,
		).Scan(&applied)
		if err != nil {
			return fmt.Errorf("gagal cek status migrasi %s: %w", name, err)
		}
		if applied {
			continue
		}

		sqlBytes, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("gagal membaca file migrasi %s: %w", name, err)
		}

		// Eksekusi multi-statement (simple query protocol) via pgconn.
		// Dibutuhkan agar file berisi banyak statement (CREATE FUNCTION/TRIGGER) bisa jalan.
		conn, err := pool.Acquire(ctx)
		if err != nil {
			return fmt.Errorf("gagal ambil koneksi untuk migrasi %s: %w", name, err)
		}
		_, err = conn.Conn().PgConn().Exec(ctx, string(sqlBytes)).ReadAll()
		conn.Release()
		if err != nil {
			return fmt.Errorf("gagal eksekusi migrasi %s: %w", name, err)
		}

		// Catat migrasi agar tidak dijalankan ulang.
		if _, err := pool.Exec(ctx,
			`INSERT INTO schema_migrations (version) VALUES ($1)`, name,
		); err != nil {
			return fmt.Errorf("gagal mencatat migrasi %s: %w", name, err)
		}
		log.Printf("✅ Migrasi diterapkan: %s", name)
	}

	return nil
}

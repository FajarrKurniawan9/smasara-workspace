package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// InitDB adalah fungsi yang akan dipanggil oleh server utama lu nanti
func InitDB() *pgxpool.Pool {
	// Buka brankas .env lu
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: File .env tidak ditemukan. Bergantung pada variabel sistem.")
	}

	// Sedot URL database dari dalam brankas
	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		log.Fatal("Error: DATABASE_URL belum diatur di file .env!")
	}

	// Konfigurasi Pool
	config, err := pgxpool.ParseConfig(dbUrl)
	if err != nil {
		log.Fatalf("Error gagal mem-parsing URL database: %v", err)
	}

	config.MaxConns = 10
	config.MaxConnIdleTime = 5 * time.Minute

	// Bikin Kolam Koneksi
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("Error gagal membuat connection pool: %v", err)
	}

	// Ping Database
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("Error: Database tidak merespons (Ping gagal): %v", err)
	}

	fmt.Println("🚀 Smasara-DB: Koneksi ke PostgreSQL berhasil ditembus!")
	return pool
}
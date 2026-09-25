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

	// Ping Database dengan mekanisme Retry (Auto-healing)
	// Mencoba koneksi selama maksimal 30 detik (15x percobaan) saat startup
	var pingErr error
	for i := 1; i <= 15; i++ {
		pingErr = pool.Ping(context.Background())
		if pingErr == nil {
			break
		}
		log.Printf("Menunggu database siap... (Percobaan %d/15)\n", i)
		time.Sleep(2 * time.Second)
	}

	if pingErr != nil {
		log.Fatalf("Fatal: Database tidak merespons setelah 30 detik (Ping gagal): %v", pingErr)
	}

	fmt.Println("🚀 Smasara-DB: Koneksi ke PostgreSQL berhasil ditembus!")
	return pool
}
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/gofiber/fiber/v2/middleware/limiter"

	// Import package database buatan lu sendiri
	"github.com/FajarrKurniawan9/smasara-backend/internal/database"
	"github.com/FajarrKurniawan9/smasara-backend/internal/handlers"
	"github.com/FajarrKurniawan9/smasara-backend/internal/middleware"
)

func main() {
	// 1. Eksekusi Koneksi Database
	// Ini bakal manggil brankas .env lu dan ngetuk pintu PostgreSQL
	dbPool := database.InitDB()
	
	// defer = "Tunda eksekusi baris ini sampai server mati/dihentikan"
	// Ini best practice biar koneksi ngga bocor (memory leak)
	defer dbPool.Close()

	queries := database.New(dbPool) // dbPool adalah variabel *pgxpool.Pool lu
	authHandler := &handlers.AuthHandler{DB: queries}
	profileHandler := &handlers.ProfileHandler{DB: queries}
	workspaceHandler := &handlers.WorkspaceHandler{DB: queries}
	folderHandler := &handlers.FolderHandler{DB: queries}
	docHandler := &handlers.DocumentHandler{DB: queries}
	// 2. Inisialisasi Mesin Fiber
	app := fiber.New()

	// 3. Bikin 1 Endpoint Test (Route)
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Halo Smasara! Backend Fiber & Database PostgreSQL udah konek! 🚀")
	})

	api := app.Group("/api")
// --- SETUP RATE LIMITER (Pelindung Anti-DDoS/Spam) ---
	authLimiter := limiter.New(limiter.Config{
		Max:        5,               // Maksimal 5 kali request
		Expiration: 1 * time.Minute, // Dalam rentang waktu 1 menit
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() // Lacak berdasarkan IP Address si pengirim
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Terlalu banyak percobaan. Sabar bro, coba lagi dalam 1 menit.",
			})
		},
	})

	// Terapkan pelindung HANYA ke rute yang rawan diserang CPU-nya
	// --- ZONA PUBLIK ---
	api.Post("/register", authLimiter, authHandler.Register)
	api.Post("/login", authLimiter, authHandler.Login)

	// --- ZONA VIP (Harus bawa JWT Valid) ---
	// Semua rute di bawah "protected" ini akan melewati pemeriksaan Satpam JWT
	protected := api.Group("/", middleware.Protected())

	// Rute untuk onboarding profil baru
	protected.Post("/profiles", authLimiter,profileHandler.CreateProfile)
	protected.Post("/workspaces", authLimiter, workspaceHandler.CreateWorkspace)

	protected.Get("/workspaces", authLimiter, workspaceHandler.GetUserWorkspaces)

	// Contoh rute test untuk memastikan Satpam bekerja:
	protected.Get("/me", func(c *fiber.Ctx) error {
		// Mengambil user_id yang tadi dititipkan oleh middleware di c.Locals
		userID := c.Locals("user_id")
		return c.JSON(fiber.Map{
			"message": "Lu berhasil masuk ke Zona VIP!",
			"user_id": userID,
		})
	})

workspaceGroup := app.Group(
		"/api/workspaces/:workspace_id",
		middleware.Protected(),
		middleware.RequireWorkspaceAccess(queries), 
	)

	// -- Rute Folder --
	workspaceGroup.Post("/folders", folderHandler.CreateFolder)
	workspaceGroup.Get("/folders", folderHandler.GetWorkspaceFolders)
	workspaceGroup.Delete("/folders/:folder_id", folderHandler.DeleteFolder) // <-- BARU: Hapus Folder Cascading

	// -- Rute Recycle Bin (Trash) --
	// PENTING: Rute "trash" harus ditaruh di ATAS rute "/:document_id" agar Fiber tidak mengira "trash" adalah sebuah ID
	workspaceGroup.Get("/documents/trash", docHandler.GetTrashedDocuments) // <-- BARU: Lihat isi Recycle Bin
	
	// -- Rute Dokumen Inti --
	workspaceGroup.Post("/documents", docHandler.CreateDocument)
	workspaceGroup.Get("/documents", docHandler.GetWorkspaceDocuments)
	workspaceGroup.Get("/documents/:document_id", docHandler.GetDocument)
	workspaceGroup.Put("/documents/:document_id", docHandler.UpdateDocument)
	workspaceGroup.Delete("/documents/:document_id", docHandler.SoftDeleteDocument)

	// -- Rute Aksi Recycle Bin --
	workspaceGroup.Patch("/documents/:document_id/restore", docHandler.RestoreDocument) // <-- BARU: Restore Dokumen
	workspaceGroup.Delete("/documents/:document_id/hard", docHandler.HardDeleteDocument) // <-- BARU: Hard Delete Dokumen

	// 4. Nyalakan Server di Port 3000
	fmt.Println("Server Smasara menyala di port 3000...")
	if err := app.Listen(":3000"); err != nil {
	log.Fatalf("Gagal menjalankan server: %v", err)}
}
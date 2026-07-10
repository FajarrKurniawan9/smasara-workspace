# Tahap Build
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Download dependensi Go
COPY go.mod go.sum ./
RUN go mod download

# Copy seluruh source code
COPY . .

# Build aplikasi menjadi binary bernama 'smasara-api'
RUN CGO_ENABLED=0 GOOS=linux go build -o smasara-api main.go

# Tahap Production (Image yang lebih ringan)
FROM alpine:latest

WORKDIR /app

# Ambil binary dari tahap builder
COPY --from=builder /app/smasara-api .

# Expose port yang digunakan aplikasi (Sesuaikan jika Anda menggunakan port lain)
EXPOSE 8080

# Jalankan aplikasi
CMD ["./smasara-api"]
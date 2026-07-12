package main

import (
	"log"
	"net/http"

	"backend/internal/application"
	"backend/internal/infrastructure/ffmpeg"
	"backend/internal/infrastructure/files"
	"backend/internal/infrastructure/jobs"
	"backend/internal/transport/httpapi"
)

func main() {
	jobStore := jobs.NewMemoryStore()
	storage := files.NewTempVideoStorage()
	processor := ffmpeg.NewProcessor(ffmpeg.Config{
		FontPaths: []string{"/app/Roboto-Regular.ttf", "./Roboto-Regular.ttf"},
	})

	exportService := application.NewExportService(jobStore, storage, processor)
	handler := httpapi.NewHandler(exportService, jobStore)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	port := "8080"
	log.Printf("Backend server listening on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

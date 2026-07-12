package app

import (
	"net/http"

	"backend/internal/application"
	"backend/internal/config"
	"backend/internal/infrastructure/ffmpeg"
	"backend/internal/infrastructure/files"
	"backend/internal/infrastructure/jobs"
	"backend/internal/transport/httpapi"
)

func NewHTTPHandler(cfg config.Config) http.Handler {
	jobStore := jobs.NewMemoryStore()
	storage := files.NewTempVideoStorage(files.Config{
		BaseDir: cfg.Export.TempDir,
	})
	processor := ffmpeg.NewProcessor(ffmpeg.Config{
		BinaryPath: cfg.Export.FFmpegBinary,
		FontPaths:  cfg.Export.FontPaths,
	})

	exportService := application.NewExportService(jobStore, storage, processor)
	handler := httpapi.NewHandler(exportService, jobStore, httpapi.Config{
		CORSAllowedOrigins: cfg.HTTP.CORSAllowedOrigins,
	})

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)
	return mux
}

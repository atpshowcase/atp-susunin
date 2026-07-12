package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"backend/internal/application"
	"backend/internal/domain"
)

type Config struct {
	CORSAllowedOrigins []string
}

type Handler struct {
	exports            *application.ExportService
	jobs               application.JobStore
	corsAllowedOrigins []string
}

func NewHandler(exports *application.ExportService, jobs application.JobStore, config Config) *Handler {
	return &Handler{
		exports:            exports,
		jobs:               jobs,
		corsAllowedOrigins: config.CORSAllowedOrigins,
	}
}

func (handler *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/export", handler.withCORS(handler.handleExport))
	mux.HandleFunc("/api/status", handler.withCORS(handler.handleStatus))
	mux.HandleFunc("/api/download", handler.withCORS(handler.handleDownload))
}

func (handler *Handler) handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(500 << 20); err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	var payload domain.ExportPayload
	if err := json.Unmarshal([]byte(r.FormValue("payload")), &payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("video")
	if err != nil {
		http.Error(w, "Missing video file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	jobID, err := handler.exports.Start(r.Context(), header.Filename, file, payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"jobId": jobID})
}

func (handler *Handler) handleStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	job, exists := handler.jobs.Get(id)
	if !exists {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, job)
}

func (handler *Handler) handleDownload(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	job, exists := handler.jobs.Get(id)
	if !exists || job.Status != domain.JobDone {
		http.Error(w, "File not ready", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Content-Disposition", "attachment; filename=\"export.mp4\"")
	http.ServeFile(w, r, job.OutputPath)
}

func (handler *Handler) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if origin := handler.allowedOrigin(r.Header.Get("Origin")); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func (handler *Handler) allowedOrigin(requestOrigin string) string {
	if len(handler.corsAllowedOrigins) == 0 {
		return ""
	}

	for _, allowedOrigin := range handler.corsAllowedOrigins {
		if allowedOrigin == "*" {
			return "*"
		}
		if strings.EqualFold(allowedOrigin, requestOrigin) {
			return requestOrigin
		}
	}

	return ""
}

func writeJSON(w http.ResponseWriter, statusCode int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(value)
}

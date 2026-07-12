package main

import (
	"log"
	"net/http"

	"backend/internal/app"
	"backend/internal/config"
)

func main() {
	cfg := config.Load()
	handler := app.NewHTTPHandler(cfg)

	log.Printf("Backend server listening on port %s (%s)", cfg.HTTP.Port, cfg.AppEnv)
	log.Fatal(http.ListenAndServe(":"+cfg.HTTP.Port, handler))
}

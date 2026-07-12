package config

import (
	"os"
	"strings"
)

const (
	defaultAppEnv   = "dev"
	defaultHTTPPort = "8080"
	defaultTempDir  = ""
)

type Config struct {
	AppEnv string
	HTTP   HTTPConfig
	Export ExportConfig
}

type HTTPConfig struct {
	Port               string
	CORSAllowedOrigins []string
}

type ExportConfig struct {
	FFmpegBinary string
	FontPaths    []string
	TempDir      string
}

func Load() Config {
	return Config{
		AppEnv: envString("APP_ENV", defaultAppEnv),
		HTTP: HTTPConfig{
			Port:               envString("BACKEND_PORT", defaultHTTPPort),
			CORSAllowedOrigins: envList("CORS_ALLOWED_ORIGINS"),
		},
		Export: ExportConfig{
			FFmpegBinary: envString("FFMPEG_BINARY", "ffmpeg"),
			FontPaths:    envList("EXPORT_FONT_PATHS"),
			TempDir:      envString("EXPORT_TEMP_DIR", defaultTempDir),
		},
	}
}

func envString(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envList(key string) []string {
	rawValue := strings.TrimSpace(os.Getenv(key))
	if rawValue == "" {
		return nil
	}

	values := strings.Split(rawValue, ",")
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

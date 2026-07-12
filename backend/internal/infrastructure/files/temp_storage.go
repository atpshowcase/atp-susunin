package files

import (
	"io"
	"os"
	"path/filepath"
)

type TempVideoStorage struct{}

func NewTempVideoStorage() *TempVideoStorage {
	return &TempVideoStorage{}
}

func (storage *TempVideoStorage) SaveUploadedVideo(jobID string, filename string, source io.Reader) (string, string, error) {
	tempDir, err := os.MkdirTemp("", "export-"+jobID)
	if err != nil {
		return "", "", err
	}

	inputExt := filepath.Ext(filename)
	if inputExt == "" {
		inputExt = ".mp4"
	}

	inputPath := filepath.Join(tempDir, "input"+inputExt)
	outputPath := filepath.Join(tempDir, "output.mp4")

	out, err := os.Create(inputPath)
	if err != nil {
		return "", "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, source); err != nil {
		return "", "", err
	}

	return inputPath, outputPath, nil
}

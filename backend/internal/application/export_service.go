package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"

	"backend/internal/domain"
)

type JobStore interface {
	Save(job *domain.JobStatus)
	Get(id string) (*domain.JobStatus, bool)
	Update(id string, update func(job *domain.JobStatus))
}

type VideoStorage interface {
	SaveUploadedVideo(jobID string, filename string, source io.Reader) (inputPath string, outputPath string, err error)
}

type VideoProcessor interface {
	Process(ctx context.Context, inputPath string, outputPath string, payload domain.ExportPayload, reportProgress func(progress float64)) error
}

type ExportService struct {
	jobs      JobStore
	storage   VideoStorage
	processor VideoProcessor
	newID     func() (string, error)
}

func NewExportService(jobs JobStore, storage VideoStorage, processor VideoProcessor) *ExportService {
	return &ExportService{
		jobs:      jobs,
		storage:   storage,
		processor: processor,
		newID:     randomHexID,
	}
}

func (service *ExportService) Start(ctx context.Context, filename string, source io.Reader, payload domain.ExportPayload) (string, error) {
	if err := payload.Validate(); err != nil {
		return "", err
	}

	jobID, err := service.newID()
	if err != nil {
		return "", err
	}

	inputPath, outputPath, err := service.storage.SaveUploadedVideo(jobID, filename, source)
	if err != nil {
		return "", err
	}

	job := domain.NewProcessingJob(jobID, outputPath)
	service.jobs.Save(job)

	go service.process(context.Background(), jobID, inputPath, outputPath, payload)

	return jobID, nil
}

func (service *ExportService) process(ctx context.Context, jobID string, inputPath string, outputPath string, payload domain.ExportPayload) {
	err := service.processor.Process(ctx, inputPath, outputPath, payload, func(progress float64) {
		service.jobs.Update(jobID, func(job *domain.JobStatus) {
			job.Progress = clampProgress(progress)
		})
	})

	if err != nil {
		service.jobs.Update(jobID, func(job *domain.JobStatus) {
			job.Status = domain.JobError
			job.Error = err.Error()
		})
		return
	}

	service.jobs.Update(jobID, func(job *domain.JobStatus) {
		job.Progress = 100
		job.Status = domain.JobDone
	})
}

func clampProgress(progress float64) float64 {
	if progress < 0 {
		return 0
	}
	if progress > 100 {
		return 100
	}
	return progress
}

func randomHexID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

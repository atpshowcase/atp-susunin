package domain

type JobState string

const (
	JobProcessing JobState = "processing"
	JobDone       JobState = "done"
	JobError      JobState = "error"
)

type JobStatus struct {
	ID         string   `json:"id"`
	Progress   float64  `json:"progress"`
	Status     JobState `json:"status"`
	Error      string   `json:"error,omitempty"`
	OutputPath string   `json:"-"`
}

func NewProcessingJob(id string, outputPath string) *JobStatus {
	return &JobStatus{
		ID:         id,
		Progress:   0,
		Status:     JobProcessing,
		OutputPath: outputPath,
	}
}

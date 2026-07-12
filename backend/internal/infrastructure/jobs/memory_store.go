package jobs

import (
	"sync"

	"backend/internal/domain"
)

type MemoryStore struct {
	mu   sync.RWMutex
	jobs map[string]*domain.JobStatus
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		jobs: make(map[string]*domain.JobStatus),
	}
}

func (store *MemoryStore) Save(job *domain.JobStatus) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.jobs[job.ID] = cloneJob(job)
}

func (store *MemoryStore) Get(id string) (*domain.JobStatus, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	job, exists := store.jobs[id]
	if !exists {
		return nil, false
	}

	return cloneJob(job), true
}

func (store *MemoryStore) Update(id string, update func(job *domain.JobStatus)) {
	store.mu.Lock()
	defer store.mu.Unlock()

	job, exists := store.jobs[id]
	if !exists {
		return
	}

	update(job)
}

func cloneJob(job *domain.JobStatus) *domain.JobStatus {
	clone := *job
	return &clone
}

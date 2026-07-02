package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

type Clip struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

type TextOverlay struct {
	Content  string  `json:"content"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Color    string  `json:"color"`
	FontSize float64 `json:"fontSize"`
	Start    float64 `json:"start"`
	End      float64 `json:"end"`
}

type ExportPayload struct {
	Clips        []Clip        `json:"clips"`
	TextOverlays []TextOverlay `json:"textOverlays"`
	ScaleFactor  float64       `json:"scaleFactor"`
	Resolution   string        `json:"resolution"`
}

type JobStatus struct {
	ID         string  `json:"id"`
	Progress   float64 `json:"progress"`
	Status     string  `json:"status"`
	Error      string  `json:"error,omitempty"`
	OutputPath string  `json:"-"`
}

var (
	jobs  = make(map[string]*JobStatus)
	mutex = &sync.Mutex{}
)

func enableCors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	(*w).Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func generateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func handleExport(w http.ResponseWriter, r *http.Request) {
	enableCors(&w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(500 << 20) // 500 MB max
	if err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	payloadStr := r.FormValue("payload")
	var payload ExportPayload
	if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("video")
	if err != nil {
		http.Error(w, "Missing video file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	jobID := generateID()
	tempDir, err := os.MkdirTemp("", "export-"+jobID)
	if err != nil {
		http.Error(w, "Could not create temp dir", http.StatusInternalServerError)
		return
	}

	inputExt := filepath.Ext(header.Filename)
	if inputExt == "" {
		inputExt = ".mp4"
	}
	inputPath := filepath.Join(tempDir, "input"+inputExt)
	outputPath := filepath.Join(tempDir, "output.mp4")

	out, err := os.Create(inputPath)
	if err != nil {
		http.Error(w, "Could not save file", http.StatusInternalServerError)
		return
	}
	io.Copy(out, file)
	out.Close()

	job := &JobStatus{
		ID:         jobID,
		Progress:   0,
		Status:     "processing",
		OutputPath: outputPath,
	}

	mutex.Lock()
	jobs[jobID] = job
	mutex.Unlock()

	go processVideo(job, inputPath, outputPath, payload)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"jobId": jobID})
}

func parseTime(timeStr string) float64 {
	parts := strings.Split(timeStr, ":")
	if len(parts) != 3 {
		return 0
	}
	h, _ := strconv.ParseFloat(parts[0], 64)
	m, _ := strconv.ParseFloat(parts[1], 64)
	s, _ := strconv.ParseFloat(parts[2], 64)
	return h*3600 + m*60 + s
}

func processVideo(job *JobStatus, inputPath string, outputPath string, payload ExportPayload) {
	filterGraph := ""
	var clipOutputs []string

	totalDuration := 0.0
	for i, clip := range payload.Clips {
		totalDuration += (clip.End - clip.Start)
		vLabel := fmt.Sprintf("[v%d]", i)
		aLabel := fmt.Sprintf("[a%d]", i)
		filterGraph += fmt.Sprintf("[0:v]trim=start=%f:end=%f,setpts=PTS-STARTPTS%s; ", clip.Start, clip.End, vLabel)
		filterGraph += fmt.Sprintf("[0:a]atrim=start=%f:end=%f,asetpts=PTS-STARTPTS%s; ", clip.Start, clip.End, aLabel)
		clipOutputs = append(clipOutputs, vLabel, aLabel)
	}

	lastVideoOutput := ""
	lastAudioOutput := ""

	if len(payload.Clips) == 1 {
		lastVideoOutput = clipOutputs[0]
		lastAudioOutput = clipOutputs[1]
	} else if len(payload.Clips) > 1 {
		concatInput := strings.Join(clipOutputs, "")
		filterGraph += fmt.Sprintf("%sconcat=n=%d:v=1:a=1[v_concat][a_concat]; ", concatInput, len(payload.Clips))
		lastVideoOutput = "[v_concat]"
		lastAudioOutput = "[a_concat]"
	} else {
		mutex.Lock()
		job.Status = "error"
		job.Error = "No clips provided"
		mutex.Unlock()
		return
	}

	fontPath := "/app/Roboto-Regular.ttf"
	if _, err := os.Stat(fontPath); os.IsNotExist(err) {
		fontPath = "./Roboto-Regular.ttf"
	}

	if len(payload.TextOverlays) == 0 {
		filterGraph += fmt.Sprintf("%snull[v_out]; ", lastVideoOutput)
		lastVideoOutput = "[v_out]"
	} else {
		for i, text := range payload.TextOverlays {
			nextOutput := fmt.Sprintf("[v_text%d]", i)
			if i == len(payload.TextOverlays)-1 {
				nextOutput = "[v_out]"
			}

			escapedText := strings.ReplaceAll(text.Content, "'", "'\\\\''")
			escapedText = strings.ReplaceAll(escapedText, ":", "\\:")
			hexColor := strings.ReplaceAll(text.Color, "#", "")
			scaledFontSize := int(math.Round(text.FontSize * payload.ScaleFactor))

			filterGraph += fmt.Sprintf("%sdrawtext=fontfile='%s':text='%s':fontcolor=0x%s:fontsize=%d:x=(w*%f/100)-(text_w/2):y=(h*%f/100)-(text_h/2):enable='between(t,%f,%f)'%s; ",
				lastVideoOutput, fontPath, escapedText, hexColor, scaledFontSize, text.X, text.Y, text.Start, text.End, nextOutput)

			lastVideoOutput = nextOutput
		}
	}

	if payload.Resolution != "" && payload.Resolution != "original" {
		height := strings.TrimSuffix(payload.Resolution, "p")
		nextOutput := "[v_out_scaled]"
		filterGraph += fmt.Sprintf("%sscale=-2:%s%s; ", lastVideoOutput, height, nextOutput)
		lastVideoOutput = nextOutput
	}

	filterGraph = strings.TrimSuffix(filterGraph, "; ")

	args := []string{
		"-y", // overwrite
		"-i", inputPath,
		"-filter_complex", filterGraph,
		"-map", lastVideoOutput,
		"-map", lastAudioOutput,
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "28",
		"-threads", "0",
		"-c:a", "aac",
		outputPath,
	}

	cmd := exec.Command("ffmpeg", args...)
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		mutex.Lock()
		job.Status = "error"
		job.Error = err.Error()
		mutex.Unlock()
		return
	}

	if err := cmd.Start(); err != nil {
		mutex.Lock()
		job.Status = "error"
		job.Error = err.Error()
		mutex.Unlock()
		return
	}

	scanner := bufio.NewScanner(stderr)
	timeRegex := regexp.MustCompile(`time=(\d{2}:\d{2}:\d{2}\.\d+)`)
	
	for scanner.Scan() {
		line := scanner.Text()
		matches := timeRegex.FindStringSubmatch(line)
		if len(matches) > 1 {
			currentTime := parseTime(matches[1])
			if totalDuration > 0 {
				progress := (currentTime / totalDuration) * 100
				if progress > 100 {
					progress = 100
				}
				mutex.Lock()
				job.Progress = progress
				mutex.Unlock()
			}
		}
	}

	if err := cmd.Wait(); err != nil {
		mutex.Lock()
		job.Status = "error"
		job.Error = err.Error()
		mutex.Unlock()
		return
	}

	mutex.Lock()
	job.Progress = 100
	job.Status = "done"
	mutex.Unlock()
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	enableCors(&w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	id := r.URL.Query().Get("id")
	mutex.Lock()
	job, exists := jobs[id]
	mutex.Unlock()

	if !exists {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	enableCors(&w)
	id := r.URL.Query().Get("id")
	mutex.Lock()
	job, exists := jobs[id]
	mutex.Unlock()

	if !exists || job.Status != "done" {
		http.Error(w, "File not ready", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Content-Disposition", "attachment; filename=\"export.mp4\"")
	http.ServeFile(w, r, job.OutputPath)
}

func main() {
	http.HandleFunc("/api/export", handleExport)
	http.HandleFunc("/api/status", handleStatus)
	http.HandleFunc("/api/download", handleDownload)

	port := "8080"
	log.Printf("Backend server listening on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

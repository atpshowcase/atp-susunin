package ffmpeg

import (
	"bufio"
	"context"
	"fmt"
	"math"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"backend/internal/domain"
)

type Config struct {
	FontPaths []string
}

type Processor struct {
	config Config
}

func NewProcessor(config Config) *Processor {
	return &Processor{config: config}
}

func (processor *Processor) Process(ctx context.Context, inputPath string, outputPath string, payload domain.ExportPayload, reportProgress func(float64)) error {
	filterGraph, lastVideoOutput, lastAudioOutput, err := processor.buildFilterGraph(payload)
	if err != nil {
		return err
	}

	args := []string{
		"-y",
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

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	totalDuration := payload.Duration()
	scanner := bufio.NewScanner(stderr)
	scanner.Split(bufio.ScanWords)
	timeRegex := regexp.MustCompile(`time=(\d{2}:\d{2}:\d{2}\.\d+)`)

	for scanner.Scan() {
		matches := timeRegex.FindStringSubmatch(scanner.Text())
		if len(matches) <= 1 || totalDuration <= 0 {
			continue
		}

		currentTime := parseTime(matches[1])
		reportProgress((currentTime / totalDuration) * 100)
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	return cmd.Wait()
}

func (processor *Processor) buildFilterGraph(payload domain.ExportPayload) (string, string, string, error) {
	if err := payload.Validate(); err != nil {
		return "", "", "", err
	}

	var graph strings.Builder
	var clipOutputs []string

	for i, clip := range payload.Clips {
		videoLabel := fmt.Sprintf("[v%d]", i)
		audioLabel := fmt.Sprintf("[a%d]", i)

		graph.WriteString(fmt.Sprintf("[0:v]trim=start=%f:end=%f,setpts=PTS-STARTPTS%s; ", clip.Start, clip.End, videoLabel))
		graph.WriteString(fmt.Sprintf("[0:a]atrim=start=%f:end=%f,asetpts=PTS-STARTPTS%s; ", clip.Start, clip.End, audioLabel))
		clipOutputs = append(clipOutputs, videoLabel, audioLabel)
	}

	lastVideoOutput, lastAudioOutput := concatClipOutputs(&graph, clipOutputs, len(payload.Clips))
	lastVideoOutput = processor.applyTextOverlays(&graph, lastVideoOutput, payload)
	lastVideoOutput = applyResolutionScale(&graph, lastVideoOutput, payload.Resolution)

	return strings.TrimSuffix(graph.String(), "; "), lastVideoOutput, lastAudioOutput, nil
}

func concatClipOutputs(graph *strings.Builder, clipOutputs []string, clipCount int) (string, string) {
	if clipCount == 1 {
		return clipOutputs[0], clipOutputs[1]
	}

	graph.WriteString(fmt.Sprintf("%sconcat=n=%d:v=1:a=1[v_concat][a_concat]; ", strings.Join(clipOutputs, ""), clipCount))
	return "[v_concat]", "[a_concat]"
}

func (processor *Processor) applyTextOverlays(graph *strings.Builder, inputLabel string, payload domain.ExportPayload) string {
	if len(payload.TextOverlays) == 0 {
		graph.WriteString(fmt.Sprintf("%snull[v_out]; ", inputLabel))
		return "[v_out]"
	}

	fontPath := processor.resolveFontPath()
	lastVideoOutput := inputLabel

	for i, text := range payload.TextOverlays {
		nextOutput := fmt.Sprintf("[v_text%d]", i)
		if i == len(payload.TextOverlays)-1 {
			nextOutput = "[v_out]"
		}

		graph.WriteString(fmt.Sprintf(
			"%sdrawtext=fontfile='%s':text='%s':fontcolor=0x%s:fontsize=%d:x=(w*%f/100)-(text_w/2):y=(h*%f/100)-(text_h/2):enable='between(t,%f,%f)'%s; ",
			lastVideoOutput,
			fontPath,
			escapeDrawText(text.Content),
			normalizeColor(text.Color),
			scaledFontSize(text.FontSize, payload.ScaleFactor),
			text.X,
			text.Y,
			text.Start,
			text.End,
			nextOutput,
		))

		lastVideoOutput = nextOutput
	}

	return lastVideoOutput
}

func applyResolutionScale(graph *strings.Builder, inputLabel string, resolution string) string {
	if resolution == "" || resolution == "original" {
		return inputLabel
	}

	height := strings.TrimSuffix(resolution, "p")
	nextOutput := "[v_out_scaled]"
	graph.WriteString(fmt.Sprintf("%sscale=-2:%s%s; ", inputLabel, height, nextOutput))
	return nextOutput
}

func (processor *Processor) resolveFontPath() string {
	for _, path := range processor.config.FontPaths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return "./Roboto-Regular.ttf"
}

func escapeDrawText(value string) string {
	escaped := strings.ReplaceAll(value, "'", "'\\\\''")
	return strings.ReplaceAll(escaped, ":", "\\:")
}

func normalizeColor(value string) string {
	return strings.ReplaceAll(value, "#", "")
}

func scaledFontSize(fontSize float64, scaleFactor float64) int {
	return int(math.Round(fontSize * scaleFactor))
}

func parseTime(timeStr string) float64 {
	parts := strings.Split(timeStr, ":")
	if len(parts) != 3 {
		return 0
	}

	hours, _ := strconv.ParseFloat(parts[0], 64)
	minutes, _ := strconv.ParseFloat(parts[1], 64)
	seconds, _ := strconv.ParseFloat(parts[2], 64)
	return hours*3600 + minutes*60 + seconds
}

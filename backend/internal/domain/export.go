package domain

import "errors"

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

func (payload ExportPayload) Validate() error {
	if len(payload.Clips) == 0 {
		return errors.New("no clips provided")
	}

	for _, clip := range payload.Clips {
		if clip.Start < 0 || clip.End <= clip.Start {
			return errors.New("clips must have a positive duration")
		}
	}

	return nil
}

func (payload ExportPayload) Duration() float64 {
	total := 0.0
	for _, clip := range payload.Clips {
		total += clip.End - clip.Start
	}
	return total
}

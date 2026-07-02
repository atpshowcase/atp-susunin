FROM golang:1.21-bullseye

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy go mod if any
COPY go.mod ./
# COPY go.sum ./ # Not needed if no external deps

# Copy source code and font
COPY . .

# Build the Go app
RUN go build -o server main.go

EXPOSE 8080

CMD ["./server"]

FROM golang:1.25.6-alpine AS build
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api

FROM alpine:3.19
RUN adduser -D -g '' app
COPY --from=build /bin/api /bin/api
COPY migrations /migrations
USER app
EXPOSE 8080
ENTRYPOINT ["/bin/api"]

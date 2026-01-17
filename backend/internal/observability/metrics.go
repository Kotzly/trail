package observability

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
)

type Metrics struct {
	RequestDuration *prometheus.HistogramVec
	RequestTotal    *prometheus.CounterVec
}

func NewMetrics(namespace string, pool *pgxpool.Pool) *Metrics {
	labels := []string{"method", "path", "status"}
	m := &Metrics{
		RequestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request duration in seconds.",
			Buckets:   prometheus.DefBuckets,
		}, labels),
		RequestTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "http_requests_total",
			Help:      "HTTP requests total.",
		}, labels),
	}
	prometheus.MustRegister(m.RequestDuration, m.RequestTotal)
	if pool != nil {
		registerPoolStats(namespace, pool)
	}
	return m
}

func registerPoolStats(namespace string, pool *pgxpool.Pool) {
	prometheus.MustRegister(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: namespace,
		Name:      "db_pool_acquired_conns",
		Help:      "Number of acquired connections.",
	}, func() float64 {
		return float64(pool.Stat().AcquiredConns())
	}))
	prometheus.MustRegister(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: namespace,
		Name:      "db_pool_idle_conns",
		Help:      "Number of idle connections.",
	}, func() float64 {
		return float64(pool.Stat().IdleConns())
	}))
	prometheus.MustRegister(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: namespace,
		Name:      "db_pool_total_conns",
		Help:      "Total connections.",
	}, func() float64 {
		return float64(pool.Stat().TotalConns())
	}))
	prometheus.MustRegister(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: namespace,
		Name:      "db_pool_max_conns",
		Help:      "Max connections configured.",
	}, func() float64 {
		return float64(pool.Config().MaxConns)
	}))
}

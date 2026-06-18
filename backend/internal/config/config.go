package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port        string
	MySQLDSN    string
	RedisAddr   string
	RedisPass   string
	RedisDB     int
	FrontendURL string
	JWTSecret   string
}

func Load() Config {
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))
	return Config{
		Port:        getEnv("PORT", "8081"),
		MySQLDSN:    getEnv("MYSQL_DSN", "zhibo:zhibo@tcp(localhost:3306)/zhibo?charset=utf8mb4&parseTime=True&loc=Local"),
		RedisAddr:   getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPass:   getEnv("REDIS_PASSWORD", ""),
		RedisDB:     redisDB,
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
		JWTSecret:   getEnv("JWT_SECRET", "zhibo-dev-jwt-secret-change-in-prod"),
	}
}

// AllowedOrigins 供 CORS 使用，支持 FRONTEND_URL + FRONTEND_URLS（逗号分隔）
func (c Config) AllowedOrigins() []string {
	seen := make(map[string]struct{})
	var out []string
	add := func(o string) {
		o = strings.TrimSpace(o)
		if o == "" {
			return
		}
		if _, ok := seen[o]; ok {
			return
		}
		seen[o] = struct{}{}
		out = append(out, o)
	}
	add(c.FrontendURL)
	if extra := os.Getenv("FRONTEND_URLS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			add(o)
		}
	}
	return out
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

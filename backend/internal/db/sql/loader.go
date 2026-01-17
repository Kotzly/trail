package sql

import "embed"

//go:embed *.sql
var fs embed.FS

func MustLoad(name string) string {
	b, err := fs.ReadFile(name)
	if err != nil {
		panic(err)
	}
	return string(b)
}

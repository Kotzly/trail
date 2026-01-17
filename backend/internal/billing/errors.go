package billing

type ProviderError struct {
	Code    string
	Message string
	Details string
}

func (e *ProviderError) Error() string {
	return e.Message
}

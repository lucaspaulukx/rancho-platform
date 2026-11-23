package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestModernReceiverScope(t *testing.T) {
	tests := []struct {
		name, query, project, roles string
		status                      int
	}{
		{"owner", "projectId=1a14", "1a14", "owner,v1-owner", 0},
		{"reader", "projectId=1a14", "1a14", "readonly,v1-readonly", 0},
		{"mismatched project", "projectId=1a15", "1a14", "v1-admin", http.StatusForbidden},
		{"ambiguous project", "projectId=1a14&projectId=1a15", "1a14", "v1-admin", http.StatusBadRequest},
		{"invalid project", "projectId=../1a14", "1a14", "v1-admin", http.StatusBadRequest},
		{"missing policy", "projectId=1a14", "1a14", "", http.StatusForbidden},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/v1-webhooks/receivers?"+test.query, nil)
			request.Header.Set("X-API-Project-Id", test.project)
			request.Header.Set(RoleAPIHeader, test.roles)
			project, status, err := getProjectID(request)
			if status != test.status || (err != nil) != (test.status != 0) {
				t.Fatalf("unexpected policy decision: %d, %v", status, err)
			}
			if status == 0 && project != test.project {
				t.Fatal("selected project differs from authenticated project")
			}
			if test.name == "reader" && hasWriteRole(request) {
				t.Fatal("read-only roles granted write access")
			}
		})
	}
}

func TestModernInvalidReceiverRejectedBeforeCattleLookup(t *testing.T) {
	// A nil client factory would panic if malformed selectors reached it.
	handler := &RouteHandler{}
	request := httptest.NewRequest(http.MethodPost, "/v1-webhooks/endpoint", nil)
	if status, err := handler.ExecuteWithKey("key/foreign", "1a14", request); status != http.StatusBadRequest || err == nil {
		t.Fatal("invalid receiver key was not rejected")
	}
	if status, err := handler.ExecuteWithKey("receiver-key", "1a14/../1a15", request); status != http.StatusBadRequest || err == nil {
		t.Fatal("invalid project was not rejected")
	}
}

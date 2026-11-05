// Diagnostic only: exact scheduler-v0.8.6 vendored WebSocket implementation.
package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

type input struct {
	URL, Access, Secret string
	EmptyPing           bool
	MaxSegment          int
}

var setProbeMSS = func(_ *websocket.Dialer, value int) bool { return value == 0 }

func main() {
	if len(os.Args) == 3 && os.Args[1] == "relay" {
		relay(os.Args[2])
		return
	}
	if len(os.Args) == 4 && os.Args[1] == "relay-window" {
		seconds, _ := strconv.Atoi(os.Args[3])
		relayWindow(os.Args[2], seconds)
		return
	}
	var in input
	raw, _ := ioutil.ReadAll(io.LimitReader(os.Stdin, 16384))
	if len(raw) > 0 && raw[0] != '{' {
		raw, _ = base64.StdEncoding.DecodeString(string(raw))
	}
	if json.Unmarshal(raw, &in) != nil {
		fmt.Printf("FIXTURE_STATUS:invalidJson=1 inputBytes=%d\n", len(raw))
		return
	}
	if (in.URL != "ws://172.21.0.4:8080/v2-beta/projects/1a12/subscribe?eventNames=resource.change" && in.URL != "ws://172.21.0.4:8080/v2-beta/subscribe?eventNames=resource.change" && in.URL != "ws://10.42.0.1:18880/v2-beta/subscribe?eventNames=resource.change") || len(in.Access) == 0 || len(in.Secret) == 0 {
		fmt.Printf("FIXTURE_STATUS:invalidFields=1 inputBytes=%d urlBytes=%d accessBytes=%d secretBytes=%d\n", len(raw), len(in.URL), len(in.Access), len(in.Secret))
		return
	}
	dialer := websocket.Dialer{HandshakeTimeout: 10 * time.Second}
	if !setProbeMSS(&dialer, in.MaxSegment) {
		fmt.Println("FIXTURE_STATUS:invalidFields=1 unsupportedMSS=1")
		return
	}
	headers := http.Header{"Authorization": []string{"Basic " + base64.StdEncoding.EncodeToString([]byte(in.Access+":"+in.Secret))}}
	conn, response, err := dialer.Dial(in.URL, headers)
	status := 0
	if response != nil {
		status = response.StatusCode
	}
	if err != nil {
		fmt.Printf("FIXTURE_STATUS:handshake=%d connected=0\n", status)
		return
	}
	defer conn.Close()
	conn.SetReadLimit(1048576)
	var mu sync.Mutex
	pings, pongs, frames, timeouts, writeErrors := 0, 0, 0, 0, 0
	var maxRTT int64
	pending := map[string]time.Time{}
	last := time.Now()
	conn.SetPongHandler(func(data string) error {
		mu.Lock()
		defer mu.Unlock()
		last = time.Now()
		pongs++
		if at, ok := pending[data]; ok {
			rtt := time.Since(at).Nanoseconds() / 1000
			if rtt > maxRTT {
				maxRTT = rtt
			}
			delete(pending, data)
		}
		return nil
	})
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
			mu.Lock()
			frames++
			mu.Unlock()
		}
	}()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	finish := time.NewTimer(35 * time.Second)
	defer finish.Stop()
	completed := 0
loop:
	for {
		select {
		case <-done:
			break loop
		case <-finish.C:
			completed = 1
			break loop
		case <-ticker.C:
			mu.Lock()
			expired := time.Since(last) > 10*time.Second
			if expired {
				timeouts++
				mu.Unlock()
				break loop
			}
			if pings >= 6 {
				mu.Unlock()
				continue
			}
			pings++
			seq := strconv.Itoa(pings)
			if in.EmptyPing {
				seq = ""
			}
			pending[seq] = time.Now()
			mu.Unlock()
			if conn.WriteControl(websocket.PingMessage, []byte(seq), time.Now().Add(time.Second)) != nil {
				writeErrors++
				break loop
			}
		}
	}
	conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1000, ""), time.Now().Add(time.Second))
	conn.Close()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
	}
	mu.Lock()
	defer mu.Unlock()
	fmt.Printf("FIXTURE_STATUS:handshake=%d connected=1 completed=%d pings=%d pongs=%d frames=%d pongTimeouts=%d writeErrors=%d maxRTTus=%d\n", status, completed, pings, pongs, frames, timeouts, writeErrors, maxRTT)
}

// One own diagnostic connection, fixed same-lab destination, no protocol inspection or payload logs.
func relay(source string) {
	allowed := net.ParseIP(source).To4()
	if allowed == nil || allowed[0] != 10 || allowed[1] != 42 || source == "10.42.0.1" {
		fmt.Println("FIXTURE_STATUS:relayReady=0")
		return
	}
	listener, err := net.Listen("tcp4", "10.42.0.1:18880")
	if err != nil {
		fmt.Println("FIXTURE_STATUS:relayReady=0")
		return
	}
	defer listener.Close()
	timer := time.AfterFunc(60*time.Second, func() { listener.Close() })
	defer timer.Stop()
	fmt.Println("FIXTURE_STATUS:relayReady=1")
	for {
		client, err := listener.Accept()
		if err != nil {
			return
		}
		peer, ok := client.RemoteAddr().(*net.TCPAddr)
		if !ok || !peer.IP.Equal(allowed) {
			client.Close()
			continue
		}
		listener.Close()
		defer client.Close()
		backend, err := net.DialTimeout("tcp4", "172.21.0.4:8080", 3*time.Second)
		if err != nil {
			return
		}
		defer backend.Close()
		deadline := time.Now().Add(45 * time.Second)
		client.SetDeadline(deadline)
		backend.SetDeadline(deadline)
		done := make(chan struct{}, 2)
		go func() { io.Copy(backend, client); done <- struct{}{} }()
		go func() { io.Copy(client, backend); done <- struct{}{} }()
		<-done
		return
	}
}

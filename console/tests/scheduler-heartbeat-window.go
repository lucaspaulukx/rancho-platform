package main

import (
	"fmt"
	"io"
	"net"
	"sync/atomic"
	"time"
)

// Bounded, one-peer lab transport experiment. Carries bytes unchanged and records only counts.
func relayWindow(source string, seconds int) {
	peer := net.ParseIP(source).To4()
	if peer == nil || peer[0] != 10 || peer[1] != 42 || source == "10.42.0.1" || seconds != 120 {
		fmt.Println("FIXTURE_STATUS:relayReady=0")
		return
	}
	listener, err := net.Listen("tcp4", "10.42.0.1:18880")
	if err != nil {
		fmt.Println("FIXTURE_STATUS:relayReady=0")
		return
	}
	defer listener.Close()
	deadline := time.Now().Add(time.Duration(seconds) * time.Second)
	timer := time.AfterFunc(time.Until(deadline), func() { listener.Close() })
	defer timer.Stop()
	slots := make(chan struct{}, 16)
	var forwarded, failures int64
	fmt.Println("FIXTURE_STATUS:relayReady=1")
	for {
		client, err := listener.Accept()
		if err != nil {
			break
		}
		address, ok := client.RemoteAddr().(*net.TCPAddr)
		if !ok || !address.IP.Equal(peer) {
			client.Close()
			continue
		}
		select {
		case slots <- struct{}{}:
			go func(c net.Conn) {
				defer func() { <-slots }()
				defer c.Close()
				upstream, err := net.DialTimeout("tcp4", "172.21.0.4:8080", 3*time.Second)
				if err != nil {
					atomic.AddInt64(&failures, 1)
					return
				}
				defer upstream.Close()
				atomic.AddInt64(&forwarded, 1)
				c.SetDeadline(deadline)
				upstream.SetDeadline(deadline)
				done := make(chan struct{}, 2)
				go func() { io.Copy(c, upstream); done <- struct{}{} }()
				go func() { io.Copy(upstream, c); done <- struct{}{} }()
				<-done
			}(client)
		default:
			client.Close()
			atomic.AddInt64(&failures, 1)
		}
	}
	fmt.Printf("FIXTURE_STATUS:relayForwarded=%d relayFailures=%d\n", atomic.LoadInt64(&forwarded), atomic.LoadInt64(&failures))
}

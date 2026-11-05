//go:build go1.11
// +build go1.11

package main

import (
	"net"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

// Applied to the probe socket before connect; does not change interface or namespace configuration.
func init() {
	setProbeMSS = func(dialer *websocket.Dialer, value int) bool {
		if value == 0 {
			return true
		}
		if value != 1000 {
			return false
		}
		dialer.NetDial = (&net.Dialer{Timeout: 10 * time.Second, Control: func(_, _ string, socket syscall.RawConn) error {
			var optionError error
			if err := socket.Control(func(fd uintptr) {
				optionError = syscall.SetsockoptInt(int(fd), syscall.IPPROTO_TCP, syscall.TCP_MAXSEG, value)
			}); err != nil {
				return err
			}
			return optionError
		}}).Dial
		return true
	}
}

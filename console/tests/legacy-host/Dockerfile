FROM alpine:3.20@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
RUN apk add --no-cache qemu-system-x86_64 qemu-img python3 curl
RUN mkdir /boot-lab && \
    curl -fL --retry 3 https://github.com/rancher/os/releases/download/v1.5.8/vmlinuz -o /boot-lab/vmlinuz && \
    curl -fL --retry 3 https://github.com/rancher/os/releases/download/v1.5.8/initrd -o /boot-lab/initrd && \
    sha256sum /boot-lab/vmlinuz /boot-lab/initrd > /boot-lab/SHA256SUMS
COPY launch.py /launch.py
CMD ["python3", "/launch.py"]

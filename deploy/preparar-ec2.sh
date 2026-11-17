#!/usr/bin/env bash
# Prepara uma EC2 Ubuntu 24.04 para rodar a plataforma (rode UMA vez).
#   - swap de 2 GB (a t3.small tem 2 GB de RAM; o RabbitMQ e o Celery precisam de folga)
#   - Docker Engine + plugin do Compose
#   - pasta ~/cobranca (onde ficam o docker-compose.yml e o .env)
#
# Uso na EC2:  sudo bash preparar-ec2.sh
# Também pode ser colado no "User data" ao criar a instância.
set -euo pipefail

USUARIO="${SUDO_USER:-ubuntu}"

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
usermod -aG docker "$USUARIO"

install -d -o "$USUARIO" -g "$USUARIO" -m 0750 "/home/$USUARIO/cobranca"

echo "Pronto. Saia e entre de novo no SSH para usar o docker sem sudo."

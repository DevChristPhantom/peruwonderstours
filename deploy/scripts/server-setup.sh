#!/usr/bin/env bash
# Preparación ÚNICA de un VPS Ubuntu 24.04 recién creado. Ejecutar como root:
#   bash server-setup.sh
# Idempotente: se puede volver a correr. No toca proyectos ya instalados.
#
# Hace: actualizaciones de seguridad automáticas, Docker oficial, usuario "deploy" (entra con la
# misma llave SSH que root), firewall (solo SSH, 80 y 443), fail2ban, 2 GB de swap, hora de Lima
# y las carpetas /srv/proxy, /srv/backups. El acceso por contraseña se desactiva SOLO si "deploy"
# ya tiene una llave SSH (para no dejarte afuera).
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "Ejecuta como root." >&2; exit 1; }
. /etc/os-release
[[ "${ID}" == "ubuntu" ]] || { echo "Pensado para Ubuntu (encontrado: ${PRETTY_NAME})." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
echo "==> Paquetes base y actualizaciones de seguridad automáticas"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl git ufw fail2ban unattended-upgrades openssl
dpkg-reconfigure -f noninteractive unattended-upgrades
timedatectl set-timezone America/Lima

echo "==> Docker (repositorio oficial)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Logs de contenedores acotados (además de los límites por servicio en cada compose).
if [[ ! -f /etc/docker/daemon.json ]]; then
  printf '{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m", "max-file": "5" }\n}\n' > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker

echo "==> Usuario deploy (sin contraseña; entra con llave SSH)"
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
if [[ -s /root/.ssh/authorized_keys && ! -s /home/deploy/.ssh/authorized_keys ]]; then
  install -m 600 -o deploy -g deploy /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
fi

echo "==> Carpetas"
install -d -o deploy -g deploy /srv/proxy /srv/proxy/sites /srv/proxy/static /srv/backups /srv/peruwonderstours

echo "==> Firewall (SSH, HTTP, HTTPS)"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> fail2ban para SSH"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> Swap de 2 GB (compilar Next.js usa mucha memoria)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

echo "==> SSH: sin contraseñas (solo si deploy ya tiene llave)"
if [[ -s /home/deploy/.ssh/authorized_keys ]]; then
  cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  sshd -t && systemctl reload ssh
  echo "    Listo: solo se entra con llave SSH."
else
  echo "    AVISO: deploy no tiene llave SSH. Agrega tu llave pública en el panel de Hostinger"
  echo "    (o en /root/.ssh/authorized_keys) y vuelve a correr este script."
fi

echo
echo "Servidor listo. Siguiente paso: docs/manual/despliegue.md, sección «Instalar el proxy»."

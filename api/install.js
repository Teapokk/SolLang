export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const SOL_TAR_URL = "https://github.com/Teapokk/SolLang/releases/download/sol2/Sol_V1.1.0-Lang_Free.tar";
  const SPS_TAR_URL = "https://github.com/Teapokk/SolLang/releases/download/SPS/SPS_V1.0.0.tar";

  const installScript = `#!/usr/bin/env bash
set -e

SOL_TAR_URL="${SOL_TAR_URL}"
SPS_TAR_URL="${SPS_TAR_URL}"

UNIQUE_LIB_NAME="YXXX_SOL_LANG"
UNIQUE_BIN_NAME="YXXX_SOL_LANG_bin"

printf "Do you really want to download Sol? [y/N] "
read -r ANSWER </dev/tty

case "$ANSWER" in
  y|Y|yes|YES)
    ;;
  *)
    echo "Installation cancelled."
    exit 0
    ;;
esac

sleep 0.25
printf "\\nCatching (Sun version)\\n\\n"
T="$(mktemp -d "\${TMPDIR:-\$HOME}/.sol_dl_XXXXXX")"
mkdir -p "$T/sol_src" "$T/sps_src"

curl -fsSL "$SOL_TAR_URL" -o "$T/sol.tar"
curl -fsSL "$SPS_TAR_URL" -o "$T/sps.tar"

sleep 0.3
printf "opening .tar\\n\\n"
tar -xf "$T/sol.tar" -C "$T/sol_src"
tar -xf "$T/sps.tar" -C "$T/sps_src"

sleep 0.25
printf "(trying to guess your terminal)\\n\\n"
OS_NAME="$(uname -s 2>/dev/null || echo Unknown)"

if [ -n "\${TERMUX_VERSION:-}" ] || [ -d "/data/data/com.termux/files/usr" ]; then
  SYS="Termux"
  BIN_DIR="\${PREFIX:-/data/data/com.termux/files/usr}/bin"
  LIB_DIR="$HOME/.local/lib/$UNIQUE_LIB_NAME"
elif [ "$OS_NAME" = "Linux" ]; then
  SYS="Linux"
  [ -w "/usr/local/bin" ] && BIN_DIR="/usr/local/bin" || BIN_DIR="$HOME/.local/bin"
  [ -w "/usr/local/lib" ] && LIB_DIR="/usr/local/lib/$UNIQUE_LIB_NAME" || LIB_DIR="$HOME/.local/lib/$UNIQUE_LIB_NAME"
elif [ "$OS_NAME" = "Darwin" ]; then
  SYS="macOS"
  [ -w "/usr/local/bin" ] && BIN_DIR="/usr/local/bin" || BIN_DIR="$HOME/.local/bin"
  LIB_DIR="$HOME/.local/lib/$UNIQUE_LIB_NAME"
else
  SYS="$OS_NAME"
  BIN_DIR="$HOME/.local/bin"
  LIB_DIR="$HOME/.local/lib/$UNIQUE_LIB_NAME"
fi

echo "Detected: $SYS -> bin: $BIN_DIR | lib: $LIB_DIR"

sleep 0.25
echo "Cleaning previous Sol installation..."
rm -rf "$LIB_DIR" "$HOME/.local/lib/sps"
mkdir -p "$BIN_DIR" "$LIB_DIR" "$LIB_DIR/sol" "$LIB_DIR/sps" "$HOME/.local/lib/sps"

SOL_BIN="$(find "$T/sol_src" -type f -name "sol" | head -n 1)"
SOL_SO="$(find "$T/sol_src" -type f -name "sol.so" | head -n 1)"

if [ -n "$SOL_BIN" ]; then
  cp -f "$SOL_BIN" "$LIB_DIR/sol/$UNIQUE_BIN_NAME"
  chmod +x "$LIB_DIR/sol/$UNIQUE_BIN_NAME"
  ln -sf "$LIB_DIR/sol/$UNIQUE_BIN_NAME" "$BIN_DIR/sol"
fi

if [ -n "$SOL_SO" ]; then
  cp -f "$SOL_SO" "$LIB_DIR/sol/sol.so"
fi

SPS_SO="$(find "$T/sps_src" -type f -name "sps.so" | head -n 1)"
SPS_ENTRY="$(find "$T/sps_src" -type f \\( -name "sps.js" -o -name "index.js" -o -name "sps" \\) | head -n 1)"
cp -rf "$T/sps_src/." "$LIB_DIR/sps/"

SPS_SO_TARGET=""
if [ -n "$SPS_SO" ]; then
  cp -f "$SPS_SO" "$HOME/.local/lib/sps/sps.so"
  SPS_SO_TARGET="$HOME/.local/lib/sps/sps.so"
fi

if [ -n "$SPS_ENTRY" ]; then
  REL_ENTRY="\${SPS_ENTRY#$T/sps_src/}"
  TARGET_ENTRY="$LIB_DIR/sps/$REL_ENTRY"
  chmod +x "$TARGET_ENTRY" 2>/dev/null || true
  if head -n 1 "$TARGET_ENTRY" 2>/dev/null | grep -q "node"; then
    cat << EOF_WRAP > "$BIN_DIR/sps"
#!/usr/bin/env bash
export SPS_LIB_PATH="${SPS_SO_TARGET}"
exec node "$TARGET_ENTRY" "\$@"
EOF_WRAP
  else
    cat << EOF_WRAP > "$BIN_DIR/sps"
#!/usr/bin/env bash
export SPS_LIB_PATH="${SPS_SO_TARGET}"
exec "$TARGET_ENTRY" "\$@"
EOF_WRAP
  fi
  chmod +x "$BIN_DIR/sps"
fi

sleep 0.2
rm -rf "$T"
echo "Sol installed successfully."
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(installScript);
}

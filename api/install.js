export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const installScript = `#!/usr/bin/env bash
set -e

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
curl -fsSL "https://github.com/Teapokk/SolLang/releases/download/Sol/Sol_V1.0.0-Lang_Free.tar" -o "$T/sol.tar"

sleep 0.3
printf "opening .tar\\n\\n"
tar -xf "$T/sol.tar" -C "$T"

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
rm -rf "$LIB_DIR"
mkdir -p "$BIN_DIR" "$LIB_DIR"

SOL_BIN="$(find "$T" -type f -name "sol" | head -n 1)"
SOL_SO="$(find "$T" -type f -name "sol.so" | head -n 1)"

if [ -n "$SOL_BIN" ]; then
  cp -f "$SOL_BIN" "$LIB_DIR/$UNIQUE_BIN_NAME"
  chmod +x "$LIB_DIR/$UNIQUE_BIN_NAME"
  ln -sf "$LIB_DIR/$UNIQUE_BIN_NAME" "$BIN_DIR/sol"
fi

if [ -n "$SOL_SO" ]; then
  cp -f "$SOL_SO" "$LIB_DIR/sol.so"
fi

sleep 0.2
rm -rf "$T"
echo "Sol installed successfully."
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(installScript);
}

#!/bin/bash

Z3_VERSION=4.13.0
KIND2_VERSION=3.0.0
SERVER_VERSION=0.5.0

ARCH=$(uname -m)

case "$1" in
  darwin-x64)
    OSTYPE=darwin
    ARCH=x86_64
    ;;
  darwin-arm64)
    OSTYPE=darwin
    ARCH=arm64
    ;;
  darwin*)
    OSTYPE=darwin
    ;;
  linux-x64)
    OSTYPE=linux
    ARCH=x86_64
    ;;
  linux-arm64)
    OSTYPE=linux
    ARCH=arm64
    ;;
  linux*)
    OSTYPE=linux
    ;;
  win32-x64)
    OSTYPE=windows
    ARCH=x86_64
    ;;
  *)
    ;;
esac

case "$OSTYPE" in
  darwin*)
    case "$ARCH" in
      x86_64)
        Z3_OS_VERSION=x64-osx-11.7.10
        KIND2_OS_VERSION=macos-12-x86_64
        ;;
      arm64)
        Z3_OS_VERSION=arm64-osx-11.0
        KIND2_OS_VERSION=macos-12-arm64
        ;;
      *)
        echo "unsupported ARCH: $ARCH";
        exit 2;;
    esac ;;
  linux*)
    case "$ARCH" in
      x86_64)
        Z3_OS_VERSION=x64-glibc-2.31
        KIND2_OS_VERSION=linux-x86_64
        ;;
      arm64)
        Z3_OS_VERSION=arm64-glibc-2.35
        KIND2_OS_VERSION=linux-arm64
        ;;
      *)
        echo "unsupported ARCH: $ARCH";
        exit 2;;
    esac ;;
  windows*|msys*|cygwin*)
    case "$ARCH" in
      x86_64|AMD64)
        Z3_OS_VERSION=x64-win
        KIND2_OS_VERSION=windows-x86_64
        EXE_SUFFIX=.exe
        KIND2_PKG_EXT=zip
        ;;
      *)
        echo "unsupported ARCH: $ARCH";
        exit 2;;
    esac ;;
  *)
    echo "unsupported OS: $OSTYPE";
    exit 1;;
esac

# Defaults for the Unix-like platforms; the Windows branch above overrides both.
# Kind 2 ships a .tar.gz everywhere except Windows, where it ships a .zip.
EXE_SUFFIX=${EXE_SUFFIX:-}
KIND2_PKG_EXT=${KIND2_PKG_EXT:-tar.gz}
Z3_BIN=z3$EXE_SUFFIX
KIND2_BIN=kind2$EXE_SUFFIX

Z3_ZIP_NAME=z3-$Z3_VERSION-$Z3_OS_VERSION
KIND2_PKG_NAME=kind2-v$KIND2_VERSION-$KIND2_OS_VERSION.$KIND2_PKG_EXT

# Install Z3
if [ -e $Z3_BIN ]; then
  echo "$Z3_BIN already present; skipping download."
else
  rm -f $Z3_ZIP_NAME.zip
  rm -rf $Z3_ZIP_NAME z3-z3-$Z3_VERSION
  wget https://github.com/Z3Prover/z3/releases/download/z3-$Z3_VERSION/$Z3_ZIP_NAME.zip
  unzip -o $Z3_ZIP_NAME.zip
  rm $Z3_ZIP_NAME.zip
  cp $Z3_ZIP_NAME/bin/$Z3_BIN .
  # z3.exe is dynamically linked against libz3.dll.
  if [ -n "$EXE_SUFFIX" ]; then cp $Z3_ZIP_NAME/bin/libz3.dll .; fi
  rm -r $Z3_ZIP_NAME
fi

# Install Kind 2
if [ -e $KIND2_BIN ]; then
  echo "$KIND2_BIN already present; skipping download."
else
  rm -f $KIND2_PKG_NAME
  wget https://github.com/kind2-mc/kind2/releases/download/v$KIND2_VERSION/$KIND2_PKG_NAME
  case "$KIND2_PKG_NAME" in
    *.zip) unzip -o $KIND2_PKG_NAME;;
    *)     tar -xf $KIND2_PKG_NAME;;
  esac
  rm $KIND2_PKG_NAME
fi

# Install language server for Kind 2
if [ -e kind2-language-server ]; then
  echo "kind2-language-server already present; skipping download."
else
  rm -f kind2-language-server.zip
  wget https://github.com/kind2-mc/kind2-language-server/releases/download/$SERVER_VERSION/kind2-language-server.zip
  unzip kind2-language-server.zip
  rm kind2-language-server.zip
fi

# Install interpreter
pushd interpreter
npm install
npm run build
popd
mkdir -p out
cp -r interpreter/dist/interpreter/browser out/interpreter

# Install Node depedencies
npm install

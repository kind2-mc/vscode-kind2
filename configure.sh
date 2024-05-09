#!/bin/bash

Z3_VERSION=4.13.0
KIND2_VERSION=2.1.1
SERVER_VERSION=0.1.8

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
  linux*)
    OSTYPE=linux
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
      *)
        echo "unsupported ARCH: $ARCH";
        exit 2;;
    esac ;;
  *)
    echo "unsupported OS: $OSTYPE";
    exit 1;;
esac

Z3_ZIP_NAME=z3-$Z3_VERSION-$Z3_OS_VERSION
KIND2_TAR_NAME=kind2-v$KIND2_VERSION-$KIND2_OS_VERSION

# Remove old configurations
rm -rf z3 kind2 kind2-language-server
rm -f $Z3_ZIP_NAME.zip
rm -rf $Z3_ZIP_NAME z3-z3-$Z3_VERSION
rm -f $KIND2_TAR_NAME.tar.gz
rm -f kind2-language-server.zip

# Install Z3
case "$2" in
  # z3-static)
  #   wget https://github.com/Z3Prover/z3/archive/refs/tags/z3-$Z3_VERSION.tar.gz
  #   tar xvf z3-$Z3_VERSION.tar.gz
  #   rm z3-$Z3_VERSION.tar.gz
  #   pushd z3-z3-$Z3_VERSION/
  #   python3 scripts/mk_make.py --staticbin
  #   pushd build/
  #   make -j4
  #   popd
  #   popd
  #   cp z3-z3-$Z3_VERSION/build/z3 .
  #   strip z3
  #   rm -r z3-z3-$Z3_VERSION/
  #   ;;
  *)
    wget https://github.com/Z3Prover/z3/releases/download/z3-$Z3_VERSION/$Z3_ZIP_NAME.zip
    unzip -o $Z3_ZIP_NAME.zip
    rm $Z3_ZIP_NAME.zip
    cp $Z3_ZIP_NAME/bin/z3 .
    rm -r $Z3_ZIP_NAME;;
esac

# Install Kind 2
wget https://github.com/kind2-mc/kind2/releases/download/v$KIND2_VERSION/$KIND2_TAR_NAME.tar.gz
tar -xf $KIND2_TAR_NAME.tar.gz
rm $KIND2_TAR_NAME.tar.gz

# Install language server for Kind 2
wget https://github.com/kind2-mc/kind2-language-server/releases/download/$SERVER_VERSION/kind2-language-server.zip
unzip kind2-language-server.zip
rm kind2-language-server.zip

# Install interpreter
pushd interpreter
npm install
npm run build
popd
mkdir -p out
cp -r interpreter/dist/interpreter out/interpreter

# Install Node depedencies
npm install

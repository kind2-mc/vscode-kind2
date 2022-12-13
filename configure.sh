#!/bin/bash

Z3_VERSION=4.11.0
KIND2_VERSION=1.7.0
SERVER_VERSION=0.1.1

case "$1" in
  macos*)
    OSTYPE=darwin
    ;;
  linux*)
    OSTYPE=linux
    ;;
  *)
    ;;
esac

case "$OSTYPE" in
  darwin*)
    Z3_OS_VERSION=osx-10.16
    KIND2_OS_VERSION=macos-11
    ;;
  linux*)
    Z3_OS_VERSION=glibc-2.31
    KIND2_OS_VERSION=linux
    ;;
  *)
    echo "unknown: $OSTYPE"
    ;;
esac

# Remove old configurations
rm -r z3 kind2 kind2-language-server
rm z3-$Z3_VERSION-x64-$Z3_OS_VERSION.zip*
rm -r z3-$Z3_VERSION-x64-$Z3_OS_VERSION
rm kind2-v$KIND2_VERSION-$KIND2_OS_VERSION-x86_64.tar.gz*
rm kind2-language-server.zip*

# Install Z3
wget https://github.com/Z3Prover/z3/releases/download/z3-$Z3_VERSION/z3-$Z3_VERSION-x64-$Z3_OS_VERSION.zip
unzip -o z3-$Z3_VERSION-x64-$Z3_OS_VERSION.zip
rm z3-$Z3_VERSION-x64-$Z3_OS_VERSION.zip
cp z3-$Z3_VERSION-x64-$Z3_OS_VERSION/bin/z3 .
rm -r z3-$Z3_VERSION-x64-$Z3_OS_VERSION

# Install Kind 2
wget https://github.com/kind2-mc/kind2/releases/download/v$KIND2_VERSION/kind2-v$KIND2_VERSION-$KIND2_OS_VERSION-x86_64.tar.gz
tar -xf kind2-v$KIND2_VERSION-$KIND2_OS_VERSION-x86_64.tar.gz
rm kind2-v$KIND2_VERSION-$KIND2_OS_VERSION-x86_64.tar.gz

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

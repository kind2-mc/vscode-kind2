#!/bin/bash

Z3_VERSION=4.8.17
KIND2_VERSION=1.6.0
SERVER_VERSION=0.1.0

# Install Z3
mkdir linux
wget https://github.com/Z3Prover/z3/releases/download/z3-$Z3_VERSION/z3-$Z3_VERSION-x64-glibc-2.31.zip
unzip -o z3-$Z3_VERSION-x64-glibc-2.31.zip
rm z3-$Z3_VERSION-x64-glibc-2.31.zip
cp z3-$Z3_VERSION-x64-glibc-2.31/bin/z3 linux
rm -r z3-$Z3_VERSION-x64-glibc-2.31

# Install Kind 2
wget https://github.com/kind2-mc/kind2/releases/download/v$KIND2_VERSION/kind2-v$KIND2_VERSION-linux-x86_64.tar.gz
tar -xf kind2-v$KIND2_VERSION-linux-x86_64.tar.gz
mv kind2 linux/kind2
rm kind2-v$KIND2_VERSION-linux-x86_64.tar.gz

# Install language server for Kind 2
wget https://github.com/kind2-mc/kind2-language-server/releases/download/$SERVER_VERSION/kind2-language-server.zip
unzip kind2-language-server.zip
rm kind2-language-server.zip

# Install interpreter
cd ../interpreter
npm install
npm run build
cd ../extension
cp -r ../interpreter/dist/interpreter interpreter

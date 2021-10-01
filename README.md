# Kind 2 Extension for VS Code
This extension provides basic support for Lustre programming language with Kind 2 annotations.

## Requirements
* Linux or MacOS environment. Windows is supported through WSL2.
* Java run-time.
  * Linux/WSL2: `sudo apt install openjdk-17-jdk`
  * MacOS: `brew install --cask temurin`
* ZeroMQ messaging library.
  * Linux/WSL2: `sudo apt install libzmq3-dev`
  * MacOS: `brew install zmq`

## Main Features
* Syntax highlighting for Lustre and Kind 2 constructs.
* Document symbol outline.
  ![Outline](gifs/outline.gif)
* Syntax and type error reports.
  ![Error reports](gifs/errors.gif)
* Model checking.
  ![Check](gifs/check.gif)
* Simulations.
  ![Simulations](gifs/simulation.gif)
* Counter-examples for falsified properties.
  ![Counter-examples](gifs/counterExample.gif)
* Raw output of calling Kind 2 through the terminal.
  ![Raw output](gifs/raw.gif)

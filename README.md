# Kind 2 Extension for VS Code
This extension provides basic support for the Lustre programming language with [Kind 2 Model Checker](https://kind2-mc.github.io/kind2) annotations.

## Requirements
Java 11+ run-time.
* Debian-based Linux: `sudo apt install openjdk-17-jdk`
* RHEL-based Linux: `sudo yum install java-17-openjdk`
* MacOS: `brew install --cask temurin`
* Windows: install a JDK from [Adoptium](https://adoptium.net/), or run `winget install EclipseAdoptium.Temurin.17.JDK`.

***Note:*** This extension only works with versions 1.5.1 and above of `kind2`.

Windows is supported natively; running the extension through WSL is no longer
required. WSL remains a working alternative: install the extension into the WSL
window with the [WSL extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl),
and it will use the Linux build.

## Options
The extension supports modular and compositional analysis modes of Kind 2. Those modes are disabled by default. Follow the steps below to enable them (and other Kind 2 configurations):
1. Go to VS Code settings.
  ![GUI settings](images/guiSettings.png)
2. Click on Kind 2 under the Extensions section.
  ![Kind 2 settings](images/guiOptions.png)
3. Enable modular, compositional, and/or other options.
  ![GUI Options](images/kind2Options.png)
4. If you prefer an editor interface, click on <span style="background-color: white">![go-to-file](images/go-to-file.png)</span> icon at the top-right corner of the settings page to switch the JSON view:
  ![JSON settings](images/jsonSettings.png)
5. Type `kind2`. VS Code will provide an autocompletion menu with available Kind 2 options. Select the options you want to configure and save your changes.
  ![JSON options](images/jsonOptions.png)

You can also enable/disable modular and compositional analysis modes from Kind's view. Click on their icons to enable them.
![Analysis modes icons](images/icons.png)

## Main Features
* Syntax highlighting for Lustre and Kind 2 constructs.
* Go-to-definition for top level declarations.
* Document symbol outline.
  ![Outline](images/outline.gif)
* Syntax and type error reports.
  ![Error reports](images/errors.gif)
* Model checking.
  ![Check](images/check.gif)
* Simulations.
  ![Simulations](images/simulation.gif)
* Counter-examples for falsified properties.
  ![Counter-examples](images/counterExample.gif)
* Raw output of calling Kind 2 through the terminal.
  ![Raw output](images/raw.gif)

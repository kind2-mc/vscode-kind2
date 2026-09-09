/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import * as vscode from 'vscode';

/**
 * Manages webview panels
 */
export class WebPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: WebPanel | undefined;

  private static readonly viewType = 'angular';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private ready: boolean;
  private onReady: () => void = () => undefined;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri): WebPanel {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it.
    // Otherwise, create angular panel.
    if (WebPanel.currentPanel) {
      if (!WebPanel.currentPanel.panel.visible) {
        WebPanel.currentPanel.panel.reveal(column);
      }
    } else {
      WebPanel.currentPanel = new WebPanel(extensionUri, column || vscode.ViewColumn.One);
    }
    return WebPanel.currentPanel;
  }

  public async sendMessage(message: any): Promise<boolean> {
    await new Promise<void>((resolve) => {
      if (this.ready) {
        resolve();
      }
      else {
        this.onReady = () => {
          resolve();
        }
      }
    });
    return await this.panel.webview.postMessage(message);
  }

  private constructor(extensionUri: vscode.Uri, column: vscode.ViewColumn) {
    this.ready = false;
    this.extensionUri = extensionUri;

    // Create and show a new webview panel
    this.panel = vscode.window.createWebviewPanel(WebPanel.viewType, 'Kind 2 Simulation View', column, {
      // Enable javascript in the webview
      enableScripts: true,

      // And restrict the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'interpreter')]
    });

    // Set the webview's initial html content
    void this._setWebviewHtml();
    this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'icons', 'kind.png');

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message: any) => {
        if (message === "ready") {
          this.ready = true;
          this.onReady();
        } else if (message.command === "showErrorMessage") {
          console.log("Error message from webview: " + message.text);
          vscode.window.showErrorMessage(message.text);
        } else if (message.command === "closeWebView"){
           console.log("Trying to close webview panel");
            WebPanel.currentPanel?.panel.dispose();
        } else {
          await vscode.commands.executeCommand(message.command, message.args[0], message.args[1], message.args[2]);
        }
      },
      null,
      this.disposables
    );
  }

  public dispose(): void {
    WebPanel.currentPanel = undefined;

    // Clean up our resources
    this.panel.dispose();

    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Returns html of the start page (index.html)
   */
  private async _setWebviewHtml(): Promise<void> {
    const appDistPath = vscode.Uri.joinPath(this.extensionUri, 'out', 'interpreter');
    const baseUri = this.panel.webview.asWebviewUri(appDistPath);
    const indexUri = vscode.Uri.joinPath(appDistPath, 'index.html');
    const indexBytes = await vscode.workspace.fs.readFile(indexUri);
    const indexHtml = new TextDecoder('utf-8').decode(indexBytes).replace('<base href="/">', `<base href="${String(baseUri)}/">`);

    this.panel.webview.html = indexHtml;
  }
}
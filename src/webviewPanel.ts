/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import * as fs from 'fs';
import * as path from 'path';
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
  private readonly extensionPath: string;
  private readonly builtAppFolder: string;
  private ready: boolean;
  private onReady: () => void;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionPath: string): WebPanel {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it.
    // Otherwise, create angular panel.
    if (WebPanel.currentPanel) {
      if (!WebPanel.currentPanel.panel.visible) {
        WebPanel.currentPanel.panel.reveal(column);
      }
    } else {
      WebPanel.currentPanel = new WebPanel(extensionPath, column || vscode.ViewColumn.One);
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

  private constructor(extensionPath: string, column: vscode.ViewColumn) {
    this.ready = false;
    this.extensionPath = extensionPath;
    this.builtAppFolder = path.join('out', 'interpreter');

    // Create and show a new webview panel
    this.panel = vscode.window.createWebviewPanel(WebPanel.viewType, 'Kind 2 Simulation View', column, {
      // Enable javascript in the webview
      enableScripts: true,

      // And restrict the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, this.builtAppFolder))]
    });

    // Set the webview's initial html content
    this.panel.webview.html = this._getHtmlForWebview();
    this.panel.iconPath = vscode.Uri.file(path.join(this.extensionPath, "icons", "kind.png"));

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message: any) => {
        if (message === "ready") {
          this.ready = true;
          this.onReady();
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
  private _getHtmlForWebview(): string {
    // path to dist folder
    const appDistPath = path.join(this.extensionPath, 'out', 'interpreter');
    const appDistPathUri = vscode.Uri.file(appDistPath);

    // path as uri
    const baseUri = this.panel.webview.asWebviewUri(appDistPathUri);

    // get path to index.html file from dist folder
    const indexPath = path.join(appDistPath, 'index.html');

    // read index file from file system
    let indexHtml = fs.readFileSync(indexPath, { encoding: 'utf8' });

    // update the base URI tag
    indexHtml = indexHtml.replace('<base href="/">', `<base href="${String(baseUri)}/">`);

    return indexHtml;
  }
}
import * as vscode from 'vscode';

import {
  BaseLanguageClient,
  LanguageClientOptions
} from 'vscode-languageclient/browser';

import type {
  MessageTransports
} from 'vscode-languageclient';

import {
  WebSocketMessageReader,
  WebSocketMessageWriter,
  toSocket
} from 'vscode-ws-jsonrpc';

/**
 * Connects to an LSP endpoint exposed over WebSocket.
 *
 * The endpoint is expected to exchange one JSON-RPC/LSP message per
 * WebSocket message.
 */
export async function createKind2LanguageClient(
  url: string
): Promise<BaseLanguageClient> {
  const transports = await createWebSocketTransports(url);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: 'lustre' }
    ],
    synchronize: {
      fileEvents:
        vscode.workspace.createFileSystemWatcher('**/.clientrc')
    },
    outputChannelName: 'Kind 2 Language Server'
  };
// SImilar to what we were doing before, but now a web socket client and in its own file
  return new WebSocketLanguageClient(
    'vscode-kind2-web',
    'Kind 2',
    clientOptions,
    transports
  );
}

class WebSocketLanguageClient extends BaseLanguageClient {
  constructor(
    id: string,
    name: string,
    clientOptions: LanguageClientOptions,
    private readonly transports: MessageTransports
  ) {
    super(id, name, clientOptions);
  }
// Needed this method to override the default createMessageTransports method in BaseLanguageClient, 
// which is not compatible with web sockets. This allows us to use the transports we created in createKind2LanguageClient.
  protected createMessageTransports(_encoding: string): Promise<MessageTransports> {
    return Promise.resolve(this.transports);
  }
}

/**
 * Converts a browser WebSocket into the reader/writer pair expected
 * by vscode-languageclient.
 */
function createWebSocketTransports(
  url: string
): Promise<MessageTransports> {
  return new Promise((resolve, reject) => {
    const webSocket = new WebSocket(url);

    let settled = false;

    const fail = (message: string): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(new Error(message));
    };

    webSocket.addEventListener(
      'error',
      () => {
        fail(`Could not connect to the Kind2 LSP at ${url}`);
      },
      { once: true }
    );

    webSocket.addEventListener(
      'close',
      event => {
        if (!settled) {
          fail(
            `Kind2 LSP connection closed before opening: ` +
            `${event.code} ${event.reason}`
          );
        }
      },
      { once: true }
    );

    webSocket.addEventListener(
      'open',
      () => {
        if (settled) {
          webSocket.close();
          return;
        }

        settled = true;

        const socket = toSocket(webSocket);

        resolve({
          reader: new WebSocketMessageReader(socket),
          writer: new WebSocketMessageWriter(socket)
        });
      },
      { once: true }
    );
  });
}
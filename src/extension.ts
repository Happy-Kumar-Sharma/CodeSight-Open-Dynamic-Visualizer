import * as vscode from 'vscode';
import { StateTranslator } from './stateTranslator';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const openCommand = vscode.commands.registerCommand('codesight.start', () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    panel = vscode.window.createWebviewPanel(
      'codesightVisualizer',
      'CodeSight Dynamic Visualizer',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // compute URIs for local webview assets
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'main.js'));
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles.css'));

    panel.webview.html = getWebviewContent(panel.webview, scriptUri.toString(), styleUri.toString());

    panel.onDidDispose(() => {
      panel = undefined;
    });

    panel.webview.onDidReceiveMessage((msg: any) => {
      // future: handle messages from the webview UI
      console.log('Message from webview:', msg);
    });
  });

  context.subscriptions.push(openCommand);

  // Register Debug Adapter Tracker factory to observe DAP traffic
  const trackerFactory: vscode.DebugAdapterTrackerFactory = {
    createDebugAdapterTracker(session: vscode.DebugSession) {
      const translator = new StateTranslator();

      const tracker: vscode.DebugAdapterTracker = {
        onDidSendMessage: (message: any) => {
          try {
            if (panel) {
              const unified = translator.translate(message, session);
              if (unified) {
                panel.webview.postMessage({ type: 'dapEvent', payload: unified });
              }
            }
          } catch (e) {
            console.error('Translation error', e);
          }
        },
        onWillStartSession: () => {},
        onWillReceiveMessage: (message: any) => {
          // optional: inspect outgoing messages
        }
      };

      return tracker;
    }
  };

  context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', trackerFactory));
}

export function deactivate() {}

function getWebviewContent(webview: vscode.Webview, scriptSrc: string, styleHref: string) {
  const nonce = getNonce();

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' https:; style-src 'unsafe-inline' https:; img-src https: data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CodeSight Visualizer</title>
<link href="${styleHref}" rel="stylesheet" />
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${scriptSrc}"></script>
</body>
</html>`;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

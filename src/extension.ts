import * as vscode from 'vscode';
import { StateTranslator } from './stateTranslator';

let panel: vscode.WebviewPanel | undefined;
let lastDapMessages: any[] = [];

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
      // handle messages from the webview UI
      console.log('Message from webview:', msg);
      if (msg && msg.command === 'requestDiagnostics') {
        const payload = lastDapMessages.slice(-500);
        panel?.webview.postMessage({ type: 'diagnostics', payload });
      }
    });
  });

  context.subscriptions.push(openCommand);

  // Register Debug Adapter Tracker factory to observe DAP traffic
  const trackerFactory: vscode.DebugAdapterTrackerFactory = {
    createDebugAdapterTracker(session: vscode.DebugSession) {
      const translator = new StateTranslator();

      const tracker: vscode.DebugAdapterTracker = {
        onWillReceiveMessage: (message: any) => {
          try {
            lastDapMessages.push({ direction: 'toAdapter', message, ts: Date.now() });
            if (lastDapMessages.length > 2000) lastDapMessages.shift();
          } catch (e) {
            console.warn('Failed to record outgoing dap message', e);
          }
        },
        onDidSendMessage: async (message: any) => {
          try {
            lastDapMessages.push({ direction: 'fromAdapter', message, ts: Date.now() });
            if (lastDapMessages.length > 2000) lastDapMessages.shift();
          } catch (e) {
            console.warn('Failed to record incoming dap message', e);
          }

          try {
            if (!panel) return;

            const unified = translator.translate(message, session);
            if (unified) {
              panel.webview.postMessage({ type: 'dapEvent', payload: unified });
              console.log('Posted to webview:', unified.kind || '(unknown)');
            }

            // When we detect a 'stopped' event, proactively request more state
            if (unified && unified.kind === 'stopped') {
              const threadId = unified.threadId;

              try {
                // Request stackTrace for the thread
                const stackResp = await session.customRequest('stackTrace', { threadId, startFrame: 0, levels: 50 });
                const stackMsg = { type: 'response', command: 'stackTrace', body: stackResp, threadId };
                const stackUnified = translator.translate(stackMsg, session);
                if (stackUnified) panel.webview.postMessage({ type: 'dapEvent', payload: stackUnified });

                // If we have frames, request scopes for the top frame
                const topFrame = (stackResp && (stackResp.stackFrames || stackResp.stackframes) && stackResp.stackFrames[0]) || null;
                const topFrameId = topFrame ? topFrame.id : null;
                if (topFrameId !== null && topFrameId !== undefined) {
                  const scopesResp = await session.customRequest('scopes', { frameId: topFrameId });
                  const scopesMsg = { type: 'response', command: 'scopes', body: scopesResp, frameId: topFrameId };
                  const scopesUnified = translator.translate(scopesMsg, session);
                  if (scopesUnified) panel.webview.postMessage({ type: 'dapEvent', payload: scopesUnified });

                  // For each scope, request variables (limit to first 6 scopes to avoid flooding)
                  const scopesList = (scopesResp && scopesResp.scopes) || [];
                  const limit = Math.min(scopesList.length, 6);
                  for (let i = 0; i < limit; i++) {
                    const scope = scopesList[i];
                    try {
                      const varsResp = await session.customRequest('variables', { variablesReference: scope.variablesReference });
                      const varsMsg = { type: 'response', command: 'variables', body: varsResp, variablesReference: scope.variablesReference, scopeName: scope.name, frameId: topFrameId };
                      const varsUnified = translator.translate(varsMsg, session);
                      if (varsUnified) panel.webview.postMessage({ type: 'dapEvent', payload: varsUnified });
                    } catch (e) {
                      console.warn('variables request failed for scope', scope, e);
                    }
                  }
                }
                // After follow-up requests, also post a diagnostics dump to help debugging
                try {
                  const diag = lastDapMessages.slice(-300);
                  panel.webview.postMessage({ type: 'diagnostics', payload: diag });
                } catch (e) {
                  console.warn('Failed to post diagnostics automatically', e);
                }
              } catch (e) {
                console.warn('Follow-up DAP requests failed', e);
              }
            }
          } catch (e) {
            console.error('Translation error', e);
          }
        },
        onWillStartSession: () => {},
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
<!-- Load D3 from CDN (allowed by CSP https:) so the webview has access to d3 global -->
<script src="https://d3js.org/d3.v7.min.js"></script>
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

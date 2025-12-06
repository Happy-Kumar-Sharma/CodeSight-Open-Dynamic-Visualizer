import * as vscode from 'vscode';

// StateTranslator: converts raw DAP messages into a unified JSON model
// This is a lightweight skeleton that recognizes common DAP responses/events
// and emits a normalized shape. It is intentionally conservative — extend
// this class to add richer heuristics for C/C++ and Python memory representation.

export class StateTranslator {
  translate(message: any, session: vscode.DebugSession): any | null {
    if (!message) return null;

    // DAP messages can be responses or events
    const type = message.type || null;
    const event = message.event || null;

    // Stopped event => useful synchronization point
    if ((type === 'event' && event === 'stopped') || (message.event === 'stopped')) {
      return {
        kind: 'stopped',
        reason: message.body?.reason || null,
        threadId: message.body?.threadId || null,
        allThreadsStopped: message.body?.allThreadsStopped || false,
        timestamp: Date.now()
      };
    }

    // Variables response (from `variables` request)
    if (type === 'response' && message.command === 'variables' && message.body) {
      return {
        kind: 'variables',
        variables: message.body.variables || [],
        requestSeq: message.request_seq || null,
        timestamp: Date.now()
      };
    }

    // Scopes response (from `scopes` request)
    if (type === 'response' && message.command === 'scopes' && message.body) {
      return {
        kind: 'scopes',
        scopes: message.body.scopes || [],
        requestSeq: message.request_seq || null,
        timestamp: Date.now()
      };
    }

    // Memory or custom events: keep them generic for now
    if (type === 'event' && (event === 'memory' || event === 'output')) {
      return {
        kind: 'event',
        eventName: event,
        body: message.body || {},
        timestamp: Date.now()
      };
    }

    // Many adapters will send `response` for `stackTrace`, `threads`, etc.
    if (type === 'response' && message.command === 'stackTrace' && message.body) {
      return {
        kind: 'stackTrace',
        stackFrames: message.body.stackFrames || [],
        timestamp: Date.now()
      };
    }

    // Unknown / unhandled message
    return null;
  }
}

import * as vscode from "vscode";

let isGhostWorking = false;

export function activate(context: vscode.ExtensionContext) {
  console.log("Ghost-tag: Global Edition Active");

  let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    const editor = vscode.window.activeTextEditor;

    // Validation: Ignore ghost edits, empty changes, or multi-cursor global edits
    if (
      !editor ||
      event.document !== editor.document ||
      event.contentChanges.length === 0 ||
      isGhostWorking
    )
      return;

    // --- NEW LOGIC: Check for multi-cursor collision ---
    // If the user has multiple cursors and they are already covering both start and end tags,
    // Ghost should stay quiet to avoid race conditions.
    if (event.contentChanges.length > 1) {
      const hasStartAndEndSelected = event.contentChanges.some((c) => {
        const text = editor.document.getText(c.range);
        return text.includes("<") || text.includes("</");
      });
      // Simplified: If many things are changing at once, let VS Code handle it.
      // This prevents "secto" style corruption.
      if (event.contentChanges.length >= 2) return;
    }

    const document = editor.document;
    const fullText = document.getText();

    const tagRegex = /<(\/?)([a-zA-Z0-9\-]+)/g;
    let tags: { name: string; isClose: boolean; offset: number }[] = [];
    let match;
    while ((match = tagRegex.exec(fullText)) !== null) {
      tags.push({ name: match[2], isClose: !!match[1], offset: match.index });
    }

    const edits: { range: vscode.Range; newText: string }[] = [];

    for (const change of event.contentChanges) {
      const cursorOffset =
        document.offsetAt(change.range.start) + change.text.length;
      const textUntilCursor = document.getText().slice(0, cursorOffset);

      const startMatch = textUntilCursor.match(/<([a-zA-Z0-9\-]*)$/);
      const endMatch = textUntilCursor.match(/<\/([a-zA-Z0-9\-]*)$/);

      const isForward = !!startMatch;
      const newName = startMatch
        ? startMatch[1]
        : endMatch
          ? endMatch[1]
          : null;

      if (newName === null) continue;

      const myTagIndex = tags.findIndex((t) =>
        isForward
          ? t.offset === cursorOffset - newName.length - 1
          : t.offset === cursorOffset - newName.length - 2,
      );
      if (myTagIndex === -1) continue;

      let stack = 0;
      let targetTag = null;

      if (isForward) {
        for (let i = myTagIndex + 1; i < tags.length; i++) {
          if (tags[i].isClose) {
            if (stack === 0) {
              targetTag = tags[i];
              break;
            }
            stack--;
          } else {
            stack++;
          }
        }
      } else {
        for (let i = myTagIndex - 1; i >= 0; i--) {
          if (!tags[i].isClose) {
            if (stack === 0) {
              targetTag = tags[i];
              break;
            }
            stack--;
          } else {
            stack++;
          }
        }
      }

      if (targetTag) {
        const targetOffset = targetTag.isClose
          ? targetTag.offset + 2
          : targetTag.offset + 1;
        const range = document.getWordRangeAtPosition(
          document.positionAt(targetOffset),
        );
        if (range) {
          edits.push({ range, newText: newName });
        }
      }
    }

    if (edits.length > 0) {
      isGhostWorking = true;
      try {
        await editor.edit(
          (editBuilder) => {
            edits.forEach((e) => editBuilder.replace(e.range, e.newText));
          },
          { undoStopBefore: false, undoStopAfter: false },
        );
      } finally {
        isGhostWorking = false;
      }
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

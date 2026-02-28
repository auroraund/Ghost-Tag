import * as vscode from "vscode";

/**
 * Ghost-tag: A VS Code extension for synchronized HTML tag editing.
 * Guiding principle: Never betray the user's intent.
 */

// Flag to prevent recursive loops when the extension itself edits the document
let isGhostWorking = false;

export function activate(context: vscode.ExtensionContext) {
  console.log("Ghost-tag: Global Edition Active");

  let disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    const editor = vscode.window.activeTextEditor;

    // --- Validation Gate ---
    // 1. Must have an active editor
    // 2. Event must belong to the active document
    // 3. Must not be an empty change
    // 4. Must not be triggered by Ghost's own edits
    if (
      !editor ||
      event.document !== editor.document ||
      event.contentChanges.length === 0 ||
      isGhostWorking
    ) {
      return;
    }

    // --- Multi-cursor Collision Handling ---
    // If multiple cursors are active (e.g., selecting both start/end tags),
    // we let VS Code handle it to avoid race conditions and corruption.
    if (event.contentChanges.length > 1) {
      if (event.contentChanges.length >= 2) return;
    }

    const document = editor.document;
    const fullText = document.getText();

    // --- Tag Scanning ---
    // Extract all tags from the document to build a "Map" of the current structure.
    // Fixed: Now allows 0-character tag names to support empty tags like <>.
    const tagRegex = /<(\/?)([a-zA-Z0-9\-]*)(?:\s+[^>]*?)?(\/?)>/g;
    let tags: { name: string; isClose: boolean; offset: number }[] = [];
    let match;
    while ((match = tagRegex.exec(fullText)) !== null) {
      const isClose = !!match[1]; // </... のとき true
      const tagName = match[2];
      const isSelfClose = !!match[3]; // .../> のとき true

      // 自ら閉じているタグ（isSelfClose）は、スタックを増減させない。
      // なので、地図（tags 配列）には含めないようにする。
      if (!isSelfClose) {
        tags.push({ name: tagName, isClose: isClose, offset: match.index });
      }
    }

    const edits: { range: vscode.Range; newText: string }[] = [];

    // Process each change (usually 1 for normal typing)
    for (const change of event.contentChanges) {
      const cursorOffset =
        document.offsetAt(change.range.start) + change.text.length;
      const textUntilCursor = document.getText().slice(0, cursorOffset);

      // Determine if the user is typing inside a start tag <... or end tag </...
      const startMatch = textUntilCursor.match(
        /<([a-zA-Z0-9\-]*)(?:\s+[^>]*?)?$/,
      );
      const endMatch = textUntilCursor.match(/<\/([a-zA-Z0-9\-]*)$/);

      const isForward = !!startMatch;
      let newName: string | null = null;

      if (startMatch) {
        newName = startMatch[1]; // Supports empty string ""
      } else if (endMatch) {
        newName = endMatch[1]; // Supports empty string ""
      }

      // If we're not inside a tag, skip
      if (newName === null) continue;

      // Identify which tag in our 'tags' map matches the cursor's current tag
      const myTagIndex = tags.findIndex((t) =>
        isForward
          ? t.offset === cursorOffset - newName.length - 1
          : t.offset === cursorOffset - newName.length - 2,
      );
      if (myTagIndex === -1) continue;

      // --- Pair Searching (Stack Logic) ---
      // Walk through the tag map to find the matching pair, respecting nested tags.
      let stack = 0;
      let targetTag = null;

      if (isForward) {
        // Look forward for the closing tag
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
        // Look backward for the opening tag
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

      // --- Range Calculation & Sync ---
      if (targetTag) {
        // Calculate the exact position where the tag name starts
        const targetOffset = targetTag.isClose
          ? targetTag.offset + 2 // After "</"
          : targetTag.offset + 1; // After "<"

        // Manual Range Creation:
        // Instead of using VS Code's word detection (which fails on empty strings),
        // we manually define the range based on the target tag's known length.
        const startPos = document.positionAt(targetOffset);
        const endPos = document.positionAt(
          targetOffset + targetTag.name.length,
        );
        const range = new vscode.Range(startPos, endPos);

        edits.push({ range, newText: newName });
      }
    }

    // --- Execute Synchronized Edits ---
    if (edits.length > 0) {
      isGhostWorking = true;
      try {
        await editor.edit(
          (editBuilder) => {
            edits.forEach((e) => editBuilder.replace(e.range, e.newText));
          },
          // Do not create a separate undo/redo entry for Ghost's sync
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

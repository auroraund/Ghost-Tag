# Ghost Tag

A high-performance, bi-directional auto rename tag extension for VS Code.
Engineered for precision, speed, and structural awareness.

## Key Features

- **Bi-directional Sync**: Seamlessly synchronizes opening and closing tags in real-time.
- **Context Awareness**: Accurately tracks nested structures using a stack-based pairing algorithm.
- **Collision Prevention**: Intelligent multi-cursor handling to prevent text corruption.
- **Attribute-Safe**: Correctly identifies tags even with complex attributes and self-closing elements (`<img />`, `<br />`).

## Supported Languages

- HTML / XML
- React (JSX / TSX)
- Vue / Svelte
- PHP / Blade

## Changelog

### 1.0.6

- **Fixed**: Support for self-closing tags. Elements like `<img />` and `<br />` no longer disrupt the nesting stack.
- **Improved**: Enhanced regex for more robust tag scanning.

### 1.0.5

- **Fixed**: Added support for tags with multiple attributes (e.g., `<a href="..." class="...">`).
- **Fixed**: Resolved incorrect pairing in deep nested structures.

### 1.0.4

- **Fixed**: Handled "empty tag name" scenarios (`<>`) to ensure closing tags are fully synchronized even when the name is deleted.
- **Core**: Switched to manual Range calculation for 100% coordinate accuracy.

### 1.0.0 - 1.0.3

- **Initial Release**: Core bi-directional synchronization and basic nesting support.

---

## About the Author

Built by **auroraund** @ **nurohive**.
[nurohive.com](https://nurohive.com)

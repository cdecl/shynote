import { Decoration, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { DecorationPlugin } from "../editor/plugin.js";
import { createTheme } from "../editor/index.js";
const classes = {
  // Unordered list classes
  lineUL: "cm-draftly-list-line-ul",
  markUL: "cm-draftly-list-mark-ul",
  // Ordered list classes
  lineOL: "cm-draftly-list-line-ol",
  markOL: "cm-draftly-list-mark-ol",
  // Task list classes
  taskLine: "cm-draftly-task-line",
  taskMarker: "cm-draftly-task-marker",
  // Common classes
  content: "cm-draftly-list-content",
  indent: "cm-draftly-list-indent",
  active: " cm-draftly-active",
  preview: "cm-draftly-preview"
};
class TaskCheckboxWidget extends WidgetType {
  constructor(checked) {
    super();
    this.checked = checked;
  }
  eq(other) {
    return other.checked === this.checked;
  }
  toDOM(view) {
    const wrap = document.createElement("span");
    wrap.className = `cm-draftly-task-checkbox ${this.checked ? "checked" : ""}`;
    wrap.setAttribute("aria-hidden", "true");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.tabIndex = -1;
    checkbox.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.toggleCheckbox(view, wrap);
    });
    wrap.appendChild(checkbox);
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
  /** Toggle the checkbox state in the document */
  toggleCheckbox(view, wrap) {
    const pos = view.posAtDOM(wrap);
    const line = view.state.doc.lineAt(pos);
    const match = line.text.match(/^(\s*(?:[-*+]|\d+\.)\s*)\[([ xX])\]/);
    if (match) {
      const markerStart = line.from + match[1].length + 1;
      const newChar = this.checked ? " " : "x";
      view.dispatch({
        changes: { from: markerStart, to: markerStart + 1, insert: newChar }
      });
    }
  }
}
class ListPlugin extends DecorationPlugin {
  constructor() {
    super(...arguments);
    this.name = "list";
    this.version = "1.0.0";
    this.decorationPriority = 20;
    this.requiredNodes = [
      "BulletList",
      "OrderedList",
      "ListItem",
      "ListMark",
      "Task",
      "TaskMarker"
    ];
  }
  get theme() {
    return theme;
  }
  /**
   * Keyboard shortcuts for list formatting
   */
  getKeymap() {
    return [
      {
        key: "Mod-Shift-8",
        run: (view) => this.toggleListOnLines(view, "- "),
        preventDefault: true
      },
      {
        key: "Mod-Shift-7",
        run: (view) => this.toggleListOnLines(view, "1. "),
        preventDefault: true
      },
      {
        key: "Mod-Shift-9",
        run: (view) => this.toggleListOnLines(view, "- [ ] "),
        preventDefault: true
      }
    ];
  }
  /**
   * Toggle list marker on current line or selected lines
   */
  toggleListOnLines(view, marker) {
    const { state } = view;
    const { from, to } = state.selection.main;
    const startLine = state.doc.lineAt(from);
    const endLine = state.doc.lineAt(to);
    const changes = [];
    const listMarkerRegex = /^(\s*)([-*+]|\d+\.)\s(\[[ xX]\]\s)?/;
    const isOrderedMarker = marker === "1. ";
    let orderNum = 1;
    for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
      const line = state.doc.line(lineNum);
      const match = line.text.match(listMarkerRegex);
      const actualMarker = isOrderedMarker ? `${orderNum}. ` : marker;
      if (match) {
        const existingMarker = match[0];
        const indent = match[1] || "";
        const isUnordered = /^[-*+]$/.test(match[2]);
        const isOrdered = /^\d+\.$/.test(match[2]);
        const hasTask = !!match[3];
        const wantUnordered = marker === "- ";
        const wantOrdered = isOrderedMarker;
        const wantTask = marker === "- [ ] ";
        if (wantUnordered && isUnordered && !hasTask || wantOrdered && isOrdered && !hasTask || wantTask && hasTask) {
          changes.push({
            from: line.from,
            to: line.from + existingMarker.length,
            insert: indent
          });
        } else {
          changes.push({
            from: line.from,
            to: line.from + existingMarker.length,
            insert: indent + actualMarker
          });
          orderNum++;
        }
      } else {
        const indentMatch = line.text.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : "";
        changes.push({
          from: line.from + indent.length,
          to: line.from + indent.length,
          insert: actualMarker
        });
        orderNum++;
      }
    }
    if (changes.length > 0) {
      view.dispatch({ changes });
    }
    return true;
  }
  buildDecorations(ctx) {
    const { view, decorations } = ctx;
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const { from, to, name } = node;
        const line = view.state.doc.lineAt(from);
        const cursorInLine = ctx.cursorInRange(line.from, line.to);
        switch (name) {
          case "ListItem":
            this.decorateListItem(node, line, decorations);
            break;
          case "ListMark":
            this.decorateListMark(node, line, decorations, cursorInLine);
            break;
          case "TaskMarker":
            this.decorateTaskMarker(from, to, view, decorations, cursorInLine);
            break;
        }
      }
    });
  }
  /** Add line decoration for list items with nesting depth */
  decorateListItem(node, line, decorations) {
    const parent = node.node.parent;
    const listType = parent?.name;
    let depth = 0;
    let ancestor = node.node.parent;
    while (ancestor) {
      if (ancestor.name === "ListItem") depth++;
      ancestor = ancestor.parent;
    }
    const hasTask = this.hasTaskChild(node);
    let lineClass;
    if (hasTask) lineClass = classes.taskLine;
    else if (listType === "OrderedList") lineClass = classes.lineOL;
    else lineClass = classes.lineUL;
    decorations.push(
      Decoration.line({
        class: lineClass,
        attributes: { style: `--depth: ${depth}` }
      }).range(line.from)
    );
  }
  /** Check if a ListItem node has a Task child */
  hasTaskChild(node) {
    const cursor = node.node.cursor();
    if (cursor.firstChild()) {
      do {
        if (cursor.name === "Task") return true;
      } while (cursor.nextSibling());
    }
    return false;
  }
  /** Decorate list markers (bullets for UL, numbers for OL) */
  decorateListMark(node, line, decorations, cursorInLine) {
    const { from, to } = node;
    const parent = node.node.parent;
    const grandparent = parent?.parent;
    const listType = grandparent?.name;
    const activeClass = cursorInLine ? classes.active : "";
    if (from > line.from) {
      decorations.push(Decoration.mark({ class: classes.indent + activeClass }).range(line.from, from));
    }
    const markClass = listType === "OrderedList" ? classes.markOL : classes.markUL;
    decorations.push(Decoration.mark({ class: markClass + activeClass }).range(from, to + 1));
    const contentStart = to + 1;
    if (contentStart < line.to) {
      decorations.push(Decoration.mark({ class: classes.content }).range(contentStart, line.to));
    }
  }
  /** Decorate task markers - show checkbox widget or raw text based on cursor */
  decorateTaskMarker(from, to, view, decorations, cursorInLine) {
    const text = view.state.sliceDoc(from, to);
    const isChecked = text.includes("x") || text.includes("X");
    if (cursorInLine) {
      decorations.push(Decoration.mark({ class: classes.taskMarker }).range(from, to));
    } else {
      decorations.push(
        Decoration.replace({
          widget: new TaskCheckboxWidget(isChecked)
        }).range(from, to)
      );
    }
  }
  /** Render list nodes to HTML */
  renderToHTML(node, children, ctx) {
    switch (node.name) {
      case "BulletList":
        return `<ul class="${classes.lineUL} ${classes.preview}">${children}</ul>
`;
      case "OrderedList":
        return `<ol class="${classes.lineOL} ${classes.preview}">${children}</ol>
`;
      case "ListItem":
        return `<li>${children}</li>
`;
      case "Task":
        return children;
      case "TaskMarker": {
        const text = ctx.sliceDoc(node.from, node.to);
        const isChecked = text.includes("x") || text.includes("X");
        return `<input type="checkbox" class="cm-draftly-task-checkbox" disabled ${isChecked ? "checked" : ""} />`;
      }
      case "ListMark":
        return "";
      default:
        return null;
    }
  }
}
const theme = createTheme({
  default: {
    // Indentation marker positioning
    ".cm-draftly-list-indent": {
      overflow: "hidden",
      display: "inline-block",
      position: "absolute",
      left: "calc(1rem * (var(--depth, 0) + 1))",
      transform: "translateX(-100%)"
    },
    // List line layout (flexbox for marker alignment)
    ".cm-draftly-list-line-ul, .cm-draftly-list-line-ol": {
      position: "relative",
      paddingLeft: "calc(1rem * (var(--depth, 0) + 1)) !important",
      display: "flex",
      alignItems: "start"
    },
    ".cm-draftly-list-line-ul > :first-child, .cm-draftly-list-line-ol > :first-child": {
      flexShrink: 0
    },
    // List marker sizing
    ".cm-draftly-list-line-ul .cm-draftly-list-mark-ul, .cm-draftly-list-line-ol .cm-draftly-list-mark-ol": {
      whiteSpace: "pre",
      position: "relative",
      width: "1rem",
      flexShrink: 0
    },
    // Hide raw marker text when not active
    ".cm-draftly-list-mark-ul:not(.cm-draftly-active) > span, .cm-draftly-task-line .cm-draftly-list-mark-ol:not(.cm-draftly-active) > span": {
      visibility: "hidden",
      display: "none"
    },
    // Styled bullet for unordered lists
    ".cm-draftly-list-line-ul .cm-draftly-list-mark-ul:not(.cm-draftly-active)::after": {
      content: '"\u2022"',
      color: "var(--color-link)",
      fontWeight: "bold",
      pointerEvents: "none"
    },
    // Task marker styling (visible when editing)
    ".cm-draftly-task-marker": {
      color: "var(--draftly-highlight, #a4a4a4)",
      fontFamily: "inherit"
    },
    // Task checkbox container
    ".cm-draftly-task-checkbox": {
      display: "inline-flex",
      verticalAlign: "middle",
      marginRight: "0.3em",
      cursor: "pointer",
      userSelect: "none",
      alignItems: "center",
      height: "1.2em"
    },
    // Task checkbox input styling
    ".cm-draftly-task-checkbox input": {
      cursor: "pointer",
      margin: 0,
      width: "1.1em",
      height: "1.1em",
      appearance: "none",
      border: "1px solid",
      borderRadius: "0.25em",
      backgroundColor: "transparent",
      position: "relative"
    },
    // Checkmark for completed tasks
    ".cm-draftly-task-checkbox.checked input::after": {
      content: '"\u2713"',
      position: "absolute",
      left: "1px",
      top: "-3px"
    },
    // Preview styles (override editor-specific layout)
    ".cm-draftly-preview": {
      display: "block",
      paddingLeft: "1.5rem",
      margin: "0.5rem 0"
    },
    ".cm-draftly-preview li": {
      display: "list-item",
      marginBottom: "0.25rem"
    },
    "ul.cm-draftly-preview": {
      listStyleType: "disc"
    },
    "ol.cm-draftly-preview": {
      listStyleType: "decimal"
    },
    // Hide list marker for task items
    ".cm-draftly-preview li:has(.cm-draftly-task-checkbox)": {
      listStyleType: "none"
    },
    ".cm-draftly-preview li .cm-draftly-paragraph": {
      padding: "0"
    }
  }
});
export {
  ListPlugin,
  TaskCheckboxWidget
};

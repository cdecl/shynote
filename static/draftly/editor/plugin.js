import { createTheme } from "./utils.js";
import { StyleModule } from "style-mod";
class DraftlyPlugin {
  constructor() {
    /** Decoration priority (higher = applied later) */
    this.decorationPriority = 100;
    /** Plugin dependencies - names of required plugins */
    this.dependencies = [];
    /** Node types this plugin handles for decorations and preview rendering */
    this.requiredNodes = [];
    /** Private configuration storage */
    this._config = {};
    /** Protected context - accessible to subclasses */
    this._context = null;
  }
  /** Get plugin configuration */
  get config() {
    return this._config;
  }
  /** Set plugin configuration */
  set config(value) {
    this._config = value;
  }
  /** Get plugin context */
  get context() {
    return this._context;
  }
  /** Plugin theme */
  get theme() {
    return createTheme({
      default: {},
      dark: {},
      light: {}
    });
  }
  // ============================================
  // EXTENSION METHODS (overridable by subclasses)
  // ============================================
  /**
   * Return CodeMirror extensions for this plugin
   * Override to provide custom extensions
   */
  getExtensions() {
    return [];
  }
  /**
   * Return markdown parser extensions
   * Override to extend markdown parsing
   */
  getMarkdownConfig() {
    return null;
  }
  /**
   * Return keybindings for this plugin
   * Override to add custom keyboard shortcuts
   */
  getKeymap() {
    return [];
  }
  // ============================================
  // DECORATION METHODS (overridable by subclasses)
  // ============================================
  /**
   * Build decorations for the current view state
   * Override to contribute decorations to the editor
   *
   * @param ctx - Decoration context with view and decoration array
   */
  buildDecorations(_ctx) {
  }
  // ============================================
  // LIFECYCLE HOOKS (overridable by subclasses)
  // ============================================
  /**
   * Called when plugin is registered with draftly
   * Override to perform initialization
   *
   * @param context - Plugin context with configuration
   */
  onRegister(context) {
    this._context = context;
  }
  /**
   * Called when plugin is unregistered
   * Override to perform cleanup
   */
  onUnregister() {
    this._context = null;
  }
  /**
   * Called when EditorView is created and ready
   * Override to perform view-specific initialization
   *
   * @param view - The EditorView instance
   */
  onViewReady(_view) {
  }
  /**
   * Called on view updates (document changes, selection changes, etc.)
   * Override to react to editor changes
   *
   * @param update - The ViewUpdate with change information
   */
  onViewUpdate(_update) {
  }
  // ============================================
  // PROTECTED UTILITIES (for subclasses)
  // ============================================
  /**
   * Helper to get current editor state
   * @param view - The EditorView instance
   */
  getState(view) {
    return view.state;
  }
  /**
   * Helper to get current document
   * @param view - The EditorView instance
   */
  getDocument(view) {
    return view.state.doc;
  }
  /**
   * Get CSS styles for preview mode
   * Override to provide custom CSS for preview rendering
   *
   * @param theme - Current theme enum
   * @returns CSS string for preview styles
   */
  getPreviewStyles(theme, wrapperClass) {
    const themeStyles = this.theme(theme);
    return this.transformToCss(themeStyles, wrapperClass);
  }
  /**
   * Transform ThemeStyle object to CSS string for preview
   * Uses cssClassMap to convert CM selectors to semantic selectors
   */
  transformToCss(themeStyles, wrapperClass) {
    const styleMod = new StyleModule(themeStyles, {
      finish: (sel) => {
        return `.${wrapperClass} ${sel}`;
      }
    });
    return styleMod.getRules();
  }
}
class DecorationPlugin extends DraftlyPlugin {
  constructor() {
    super(...arguments);
    /**
     * Decoration priority - lower than default for decoration plugins
     * Override to customize
     */
    this.decorationPriority = 50;
  }
}
class SyntaxPlugin extends DraftlyPlugin {
}
export {
  DecorationPlugin,
  DraftlyPlugin,
  SyntaxPlugin
};

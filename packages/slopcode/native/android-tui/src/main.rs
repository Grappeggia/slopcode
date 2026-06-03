use std::collections::HashMap;
use std::env;
use std::io::{self, IsTerminal, Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crossterm::cursor::{Hide, Show};
use crossterm::execute;
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap};
use ratatui::{Frame, Terminal, TerminalOptions, Viewport};
use serde_json::{json, Value};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
const TUI_CORE_VERSION: &str = "rust-ratatui-1";
const DEFAULT_THEME_NAMES: &[&str] = &[
    "aura",
    "carbonfox",
    "catppuccin",
    "catppuccin-frappe",
    "catppuccin-macchiato",
    "cobalt2",
    "dracula",
    "gruvbox",
    "kanagawa",
    "lucent-orng",
    "mercury",
    "monokai",
    "nightowl",
    "nord",
    "one-dark",
    "orng",
    "osaka-jade",
    "palenight",
    "rosepine",
    "slopcode",
    "solarized",
    "synthwave84",
    "system",
    "tokyonight",
    "vercel",
    "vesper",
    "zenburn",
];

fn startup_trace_enabled() -> bool {
    env::var("SLOPCODE_ANDROID_STARTUP_LOG").is_ok_and(|item| {
        let value = item.to_ascii_lowercase();
        value == "1" || value == "true" || value == "on"
    })
}

fn startup_log(start: Instant, phase: &str, extra: Value) {
    if !startup_trace_enabled() {
        return;
    }
    let mut payload = json!({
        "event": "android.startup",
        "phase": phase,
        "ms": start.elapsed().as_millis(),
    });
    if let (Some(payload), Some(extra)) = (payload.as_object_mut(), extra.as_object()) {
        for (key, value) in extra {
            payload.insert(key.clone(), value.clone());
        }
    }
    eprintln!("{payload}");
}

#[derive(Clone, Default)]
struct Args {
    url: String,
    token: String,
    cwd: Option<String>,
    view_id: Option<String>,
    session: Option<String>,
    cont: bool,
    fork: bool,
    model: Option<String>,
    agent: Option<String>,
    prompt: Option<String>,
}

#[derive(Clone, Default)]
struct Buffer {
    text: String,
    cursor: usize,
}

impl Buffer {
    fn len(&self) -> usize {
        self.text.chars().count()
    }

    fn byte(&self, index: usize) -> usize {
        if index == 0 {
            return 0;
        }
        self.text
            .char_indices()
            .nth(index)
            .map(|item| item.0)
            .unwrap_or(self.text.len())
    }

    fn set(&mut self, text: String) {
        self.text = text;
        self.cursor = self.len();
    }

    fn clear(&mut self) -> String {
        self.cursor = 0;
        std::mem::take(&mut self.text)
    }

    fn insert(&mut self, text: &str) {
        self.text.insert_str(self.byte(self.cursor), text);
        self.cursor += text.chars().count();
    }

    fn backspace(&mut self) {
        if self.cursor == 0 {
            return;
        }
        let start = self.byte(self.cursor - 1);
        let end = self.byte(self.cursor);
        self.text.replace_range(start..end, "");
        self.cursor -= 1;
    }

    fn delete(&mut self) {
        if self.cursor >= self.len() {
            return;
        }
        let start = self.byte(self.cursor);
        let end = self.byte(self.cursor + 1);
        self.text.replace_range(start..end, "");
    }

    fn left(&mut self) {
        self.cursor = self.cursor.saturating_sub(1);
    }

    fn right(&mut self) {
        self.cursor = (self.cursor + 1).min(self.len());
    }

    fn home(&mut self) {
        self.cursor = 0;
    }

    fn end(&mut self) {
        self.cursor = self.len();
    }

    fn char_at(&self, index: usize) -> Option<char> {
        self.text.chars().nth(index)
    }

    fn line_home(&mut self) {
        while self.cursor > 0 && self.char_at(self.cursor - 1) != Some('\n') {
            self.cursor -= 1;
        }
    }

    fn line_end(&mut self) {
        while self.cursor < self.len() && self.char_at(self.cursor) != Some('\n') {
            self.cursor += 1;
        }
    }

    fn word_forward(&mut self) {
        while self.cursor < self.len() && self.char_at(self.cursor).is_some_and(char::is_whitespace)
        {
            self.cursor += 1;
        }
        while self.cursor < self.len()
            && self
                .char_at(self.cursor)
                .is_some_and(|ch| !ch.is_whitespace())
        {
            self.cursor += 1;
        }
    }

    fn word_backward(&mut self) {
        while self.cursor > 0
            && self
                .char_at(self.cursor - 1)
                .is_some_and(char::is_whitespace)
        {
            self.cursor -= 1;
        }
        while self.cursor > 0
            && self
                .char_at(self.cursor - 1)
                .is_some_and(|ch| !ch.is_whitespace())
        {
            self.cursor -= 1;
        }
    }

    fn delete_range(&mut self, start: usize, end: usize) {
        if start >= end {
            return;
        }
        let start_byte = self.byte(start);
        let end_byte = self.byte(end);
        self.text.replace_range(start_byte..end_byte, "");
        self.cursor = self.cursor.min(start);
    }

    fn kill_to_line_start(&mut self) {
        let end = self.cursor;
        self.line_home();
        self.delete_range(self.cursor, end);
    }

    fn kill_to_line_end(&mut self) {
        let start = self.cursor;
        let mut end = self.cursor;
        while end < self.len() && self.char_at(end) != Some('\n') {
            end += 1;
        }
        self.delete_range(start, end);
    }

    fn delete_word_before(&mut self) {
        while self.cursor > 0
            && self
                .text
                .chars()
                .nth(self.cursor - 1)
                .is_some_and(char::is_whitespace)
        {
            self.backspace();
        }
        while self.cursor > 0
            && self
                .text
                .chars()
                .nth(self.cursor - 1)
                .is_some_and(|ch| !ch.is_whitespace())
        {
            self.backspace();
        }
    }

    fn delete_word_after(&mut self) {
        let start = self.cursor;
        let mut end = self.cursor;
        while end < self.len() && self.char_at(end).is_some_and(char::is_whitespace) {
            end += 1;
        }
        while end < self.len() && self.char_at(end).is_some_and(|ch| !ch.is_whitespace()) {
            end += 1;
        }
        self.delete_range(start, end);
    }

    fn rendered(&self) -> String {
        let mut out = String::new();
        for (index, ch) in self.text.chars().enumerate() {
            if index == self.cursor {
                out.push('|');
            }
            out.push(ch);
        }
        if self.cursor == self.len() {
            out.push('|');
        }
        out
    }
}

#[derive(Clone)]
struct Message {
    id: String,
    role: String,
    text: String,
    tools: Vec<String>,
}

#[derive(Clone)]
struct Permission {
    id: String,
    session: String,
    kind: Option<String>,
    permission: String,
    patterns: Vec<String>,
    file: Option<String>,
    diff: Option<String>,
    source: Option<String>,
    request_reason: Option<String>,
    reject_reason: Option<String>,
    selected: bool,
}

#[derive(Clone)]
struct QuestionItem {
    header: String,
    question: String,
    options: Vec<(String, String)>,
    multiple: bool,
    custom: bool,
}

#[derive(Clone)]
struct Question {
    id: String,
    session: String,
    items: Vec<QuestionItem>,
    index: usize,
    answers: Vec<Vec<String>>,
    custom: Vec<String>,
    input: Buffer,
    selected: usize,
    editing: bool,
}

#[derive(Clone, Default)]
struct Editor {
    id: String,
    file: String,
    dirty: bool,
    diff: bool,
    diagnostics: Vec<String>,
    preview: Vec<String>,
}

#[derive(Clone)]
struct Panel {
    title: String,
    rows: Vec<String>,
}

#[derive(Clone, Default)]
struct CommandPalette {
    query: String,
    selected: usize,
}

#[derive(Clone)]
struct Tab {
    id: String,
    title: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CommandSource {
    Ui,
    Prompt,
}

impl Default for CommandSource {
    fn default() -> Self {
        CommandSource::Ui
    }
}

#[derive(Clone, Default)]
struct SurfaceCommand {
    id: String,
    title: String,
    category: String,
    slash: Option<String>,
    aliases: Vec<String>,
    usage: Option<String>,
    keybind: Option<String>,
    description: Option<String>,
    source: CommandSource,
}

#[derive(Clone, Default)]
struct SurfaceManifest {
    commands: Vec<SurfaceCommand>,
    keybinds: HashMap<String, String>,
    capabilities: HashMap<String, bool>,
}

impl SurfaceManifest {
    fn find(&self, name: &str) -> Option<SurfaceCommand> {
        let needle = name.trim_start_matches('/');
        self.commands
            .iter()
            .find(|command| {
                command.slash.as_deref() == Some(needle)
                    || command.aliases.iter().any(|alias| alias == needle)
            })
            .cloned()
    }

    fn has_name(&self, name: &str) -> bool {
        self.find(name).is_some()
    }

    fn upsert(&mut self, command: SurfaceCommand) {
        if let Some(existing) = self.commands.iter_mut().find(|item| item.id == command.id) {
            *existing = command;
            return;
        }
        self.commands.push(command);
    }

    fn command_names(&self) -> Vec<String> {
        let mut out = Vec::new();
        for command in &self.commands {
            if let Some(slash) = &command.slash {
                out.push(format!("/{slash}"));
            }
            for alias in &command.aliases {
                out.push(format!("/{alias}"));
            }
        }
        out.sort();
        out.dedup();
        out
    }

    fn command_matches(&self, query: &str) -> Vec<SurfaceCommand> {
        let needle = query.trim().to_lowercase();
        self.commands
            .iter()
            .filter(|command| {
                let slash = command.slash.as_deref().unwrap_or(command.id.as_str());
                let aliases = command.aliases.join(" ");
                let haystack = format!(
                    "{} {} {} {} {} {}",
                    command.id,
                    command.title,
                    command.category,
                    slash,
                    aliases,
                    command.description.as_deref().unwrap_or_default()
                )
                .to_lowercase();
                needle.is_empty() || haystack.contains(&needle)
            })
            .cloned()
            .collect()
    }

    fn command_display(&self, command: &SurfaceCommand) -> String {
        let slash = command.slash.as_deref().unwrap_or(command.id.as_str());
        let aliases = if command.aliases.is_empty() {
            String::new()
        } else {
            format!(
                " ({})",
                command
                    .aliases
                    .iter()
                    .map(|item| format!("/{item}"))
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        };
        let keybind = command
            .keybind
            .as_ref()
            .and_then(|key| self.keybinds.get(key))
            .filter(|value| value.as_str() != "none")
            .map(|value| format!("  {value}"))
            .unwrap_or_default();
        let usage = command
            .usage
            .as_ref()
            .map(|value| format!("  {value}"))
            .unwrap_or_default();
        let description = command
            .description
            .as_ref()
            .map(|value| format!("  {value}"))
            .unwrap_or_default();
        let slash = if slash.starts_with('/') {
            slash.to_string()
        } else {
            format!("/{slash}")
        };
        format!(
            "{}: {slash}{aliases}  {}{keybind}{usage}{description}",
            command.category, command.title
        )
    }

    fn command_rows(&self, query: &str) -> Vec<String> {
        let mut rows = Vec::new();
        for command in self.command_matches(query) {
            rows.push(self.command_display(&command));
        }
        if rows.is_empty() {
            return vec![format!("No commands match {query}")];
        }
        rows
    }

    fn keybind_rows(&self) -> Vec<String> {
        let mut rows = Vec::new();
        for command in &self.commands {
            let Some(key) = &command.keybind else {
                continue;
            };
            let Some(value) = self.keybinds.get(key) else {
                continue;
            };
            if value == "none" {
                continue;
            }
            let slash = command
                .slash
                .as_ref()
                .map(|item| format!("/{item}"))
                .unwrap_or_else(|| command.id.clone());
            rows.push(format!("{value:<18} {slash:<18} {}", command.title));
        }
        rows.extend([
            String::from("Enter             submit input"),
            String::from("Ctrl-D            exit or leave dialog"),
            String::from("Ctrl-U            clear before cursor"),
            String::from("Ctrl-K            clear after cursor"),
            String::from("Ctrl-W            delete previous word"),
            String::from("Tab               complete slash commands"),
            String::from("Up/Down           prompt history"),
            String::from("F12/F13           stash/restore prompt"),
        ]);
        rows
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SidebarMode {
    Summary,
    Files,
}

struct State {
    args: Args,
    session: Option<String>,
    title: String,
    status: String,
    connected: bool,
    input: Buffer,
    history: Vec<String>,
    history_index: Option<usize>,
    history_draft: String,
    model: Option<String>,
    agent: Option<String>,
    shell: bool,
    history_mode: bool,
    show_timestamps: bool,
    show_thinking: bool,
    queue: Vec<String>,
    stash: Vec<String>,
    attached: Vec<String>,
    messages: HashMap<String, Message>,
    order: Vec<String>,
    notices: Vec<String>,
    panel: Option<Panel>,
    command_palette: Option<CommandPalette>,
    sidebar: bool,
    sidebar_mode: SidebarMode,
    sidebar_rows: Vec<String>,
    tabs: Vec<Tab>,
    footer_directory: String,
    footer_workspace: Option<String>,
    footer_lsp: usize,
    footer_mcp: usize,
    footer_mcp_failed: bool,
    footer_permissions: usize,
    open_files: Vec<String>,
    editor: Option<Editor>,
    editor_focus: bool,
    permissions: Vec<Permission>,
    permission: Option<Permission>,
    permission_index: usize,
    question: Option<Question>,
    manifest: SurfaceManifest,
    surface_frame: Option<Vec<String>>,
    surface_hydrated: bool,
}

impl State {
    fn new(args: Args, width: u16, height: u16) -> Self {
        let cwd = args
            .cwd
            .clone()
            .or_else(|| {
                env::current_dir()
                    .ok()
                    .map(|item| item.display().to_string())
            })
            .unwrap_or_else(|| String::from("."));
        Self {
            session: args.session.clone(),
            title: String::from("SlopCode"),
            status: String::from("starting"),
            connected: false,
            input: Buffer::default(),
            history: Vec::new(),
            history_index: None,
            history_draft: String::new(),
            model: args.model.clone(),
            agent: args.agent.clone(),
            shell: false,
            history_mode: false,
            show_timestamps: false,
            show_thinking: true,
            queue: Vec::new(),
            stash: Vec::new(),
            attached: Vec::new(),
            messages: HashMap::new(),
            order: Vec::new(),
            notices: vec![format!("cwd {cwd}")],
            panel: None,
            command_palette: None,
            sidebar: false,
            sidebar_mode: SidebarMode::Summary,
            sidebar_rows: Vec::new(),
            tabs: Vec::new(),
            footer_directory: cwd.clone(),
            footer_workspace: None,
            footer_lsp: 0,
            footer_mcp: 0,
            footer_mcp_failed: false,
            footer_permissions: 0,
            open_files: Vec::new(),
            editor: None,
            editor_focus: false,
            permissions: Vec::new(),
            permission: None,
            permission_index: 0,
            question: None,
            manifest: fallback_manifest(),
            surface_frame: Some(initial_surface_frame(width, height, &cwd, None, 0, false)),
            surface_hydrated: false,
            args,
        }
    }

    fn notice(&mut self, text: impl Into<String>) {
        self.notices.push(text.into());
        if self.notices.len() > 6 {
            self.notices.remove(0);
        }
    }

    fn panel(&mut self, title: impl Into<String>, rows: Vec<String>) {
        self.command_palette = None;
        self.panel = Some(Panel {
            title: title.into(),
            rows,
        });
    }

    fn command_palette(&mut self) {
        self.panel = None;
        self.command_palette = Some(CommandPalette::default());
    }

    fn push_message(&mut self, message: Message) {
        if !self.order.iter().any(|item| item == &message.id) {
            self.order.push(message.id.clone());
        }
        self.messages.insert(message.id.clone(), message);
    }

    fn sync_tab(&mut self, id: &str, title: &str) {
        let title = if title.is_empty() { id } else { title };
        if let Some(tab) = self.tabs.iter_mut().find(|item| item.id == id) {
            tab.title = title.to_string();
            return;
        }
        self.tabs.push(Tab {
            id: id.to_string(),
            title: title.to_string(),
        });
        if self.tabs.len() > 8 {
            self.tabs.remove(0);
        }
    }

    fn history_prev(&mut self) {
        if self.history.is_empty() {
            return;
        }
        match self.history_index {
            None => {
                self.history_draft = self.input.text.clone();
                let index = self.history.len() - 1;
                self.history_index = Some(index);
                self.input.set(self.history[index].clone());
            }
            Some(0) => {}
            Some(index) => {
                let next = index - 1;
                self.history_index = Some(next);
                self.input.set(self.history[next].clone());
            }
        }
    }

    fn history_next(&mut self) {
        let Some(index) = self.history_index else {
            return;
        };
        if index + 1 >= self.history.len() {
            self.history_index = None;
            self.input.set(std::mem::take(&mut self.history_draft));
            return;
        }
        let next = index + 1;
        self.history_index = Some(next);
        self.input.set(self.history[next].clone());
    }
}

#[derive(Clone)]
struct Client {
    url: String,
    token: String,
}

struct Url {
    host: String,
    port: u16,
    base: String,
}

const FALLBACK_COMMANDS: &[(&str, &str, &str, &[&str], Option<&str>)] = &[
    (
        "help.show",
        "Help",
        "System",
        &["help", "commands"],
        Some("command_list"),
    ),
    (
        "session.new",
        "New Session",
        "Session",
        &["new"],
        Some("session_new"),
    ),
    (
        "session.list",
        "Sessions",
        "Session",
        &["sessions", "session"],
        Some("session_list"),
    ),
    (
        "session.tabs",
        "Tabs",
        "Session",
        &["tabs"],
        Some("session_tabs_next"),
    ),
    (
        "session.children",
        "Child Sessions",
        "Session",
        &["children"],
        Some("session_child_first"),
    ),
    (
        "session.timeline",
        "Timeline",
        "Session",
        &["timeline", "messages"],
        Some("session_timeline"),
    ),
    (
        "session.status",
        "Status",
        "Session",
        &["status"],
        Some("status_view"),
    ),
    (
        "session.share",
        "Share",
        "Session",
        &["share"],
        Some("session_share"),
    ),
    (
        "session.unshare",
        "Unshare",
        "Session",
        &["unshare"],
        Some("session_unshare"),
    ),
    (
        "session.compact",
        "Compact",
        "Session",
        &["compact"],
        Some("session_compact"),
    ),
    (
        "session.interrupt",
        "Interrupt",
        "Session",
        &["interrupt", "abort"],
        Some("session_interrupt"),
    ),
    (
        "session.fork",
        "Fork",
        "Session",
        &["fork"],
        Some("session_fork"),
    ),
    ("session.close", "Close Tab", "Session", &["close"], None),
    ("session.pause", "Pause", "Session", &["pause"], None),
    ("session.resume", "Resume", "Session", &["resume"], None),
    (
        "session.revert",
        "Revert",
        "Session",
        &["revert"],
        Some("messages_undo"),
    ),
    (
        "session.unrevert",
        "Unrevert",
        "Session",
        &["unrevert"],
        Some("messages_redo"),
    ),
    (
        "session.title",
        "Rename",
        "Session",
        &["title"],
        Some("session_rename"),
    ),
    (
        "model.list",
        "Models",
        "Agent",
        &["models", "model"],
        Some("model_list"),
    ),
    (
        "provider.list",
        "Providers",
        "Agent",
        &["providers", "connect"],
        None,
    ),
    (
        "agent.list",
        "Agents",
        "Agent",
        &["agents", "agent"],
        Some("agent_list"),
    ),
    (
        "sidebar.summary",
        "Modified Files",
        "Workspace",
        &["summary", "sidebar"],
        Some("sidebar_toggle"),
    ),
    (
        "sidebar.files",
        "Files",
        "Workspace",
        &["files"],
        Some("session_files"),
    ),
    ("file.open", "Open File", "Workspace", &["open"], None),
    ("file.attach", "Attach File", "Workspace", &["attach"], None),
    (
        "editor.focus",
        "Edit",
        "Editor",
        &["edit"],
        Some("editor_open"),
    ),
    ("editor.save", "Save Editor", "Editor", &["save"], None),
    (
        "editor.diagnostics",
        "Diagnostics",
        "Editor",
        &["diagnostics"],
        None,
    ),
    ("editor.diff", "Diff", "Editor", &["diff"], None),
    (
        "editor.close",
        "Close Editor",
        "Editor",
        &["close-editor", "close-editor!"],
        None,
    ),
    ("prompt.queue", "Prompt Queue", "Prompt", &["queue"], None),
    (
        "prompt.stash",
        "Prompt Stash",
        "Prompt",
        &["stash", "list", "pop"],
        None,
    ),
    ("prompt.shell", "Shell Mode", "Prompt", &["shell"], None),
    (
        "theme.list",
        "Themes",
        "System",
        &["themes"],
        Some("theme_list"),
    ),
    (
        "terminal.suspend",
        "Suspend",
        "System",
        &["suspend"],
        Some("terminal_suspend"),
    ),
    ("keybinds.list", "Keybinds", "System", &["keybinds"], None),
    (
        "clipboard.status",
        "Clipboard",
        "System",
        &["clipboard"],
        None,
    ),
    (
        "plugins.list",
        "Plugins",
        "System",
        &["plugins", "mcps"],
        Some("plugin_manager"),
    ),
    (
        "android.doctor",
        "Android Runtime",
        "System",
        &["doctor"],
        None,
    ),
];

fn fallback_manifest() -> SurfaceManifest {
    let mut keybinds = HashMap::new();
    keybinds.insert(String::from("command_list"), String::from("ctrl+p"));
    keybinds.insert(String::from("session_new"), String::from("ctrl+x+n"));
    keybinds.insert(String::from("session_list"), String::from("ctrl+x+l"));
    keybinds.insert(String::from("session_tabs_next"), String::from("ctrl+x+]"));
    keybinds.insert(
        String::from("session_child_first"),
        String::from("ctrl+x+down"),
    );
    keybinds.insert(String::from("session_timeline"), String::from("ctrl+x+g"));
    keybinds.insert(String::from("status_view"), String::from("ctrl+x+s"));
    keybinds.insert(String::from("session_compact"), String::from("ctrl+x+c"));
    keybinds.insert(String::from("session_interrupt"), String::from("escape"));
    keybinds.insert(String::from("messages_undo"), String::from("ctrl+x+u"));
    keybinds.insert(String::from("messages_redo"), String::from("ctrl+x+r"));
    keybinds.insert(String::from("session_rename"), String::from("ctrl+r"));
    keybinds.insert(String::from("model_list"), String::from("ctrl+x+m"));
    keybinds.insert(String::from("agent_list"), String::from("ctrl+x+a"));
    keybinds.insert(String::from("sidebar_toggle"), String::from("ctrl+x+b"));
    keybinds.insert(String::from("session_files"), String::from("ctrl+x+f"));
    keybinds.insert(String::from("editor_open"), String::from("ctrl+x+e"));
    keybinds.insert(String::from("theme_list"), String::from("ctrl+x+t"));
    keybinds.insert(String::from("terminal_suspend"), String::from("ctrl+z"));
    let commands = FALLBACK_COMMANDS
        .iter()
        .map(|(id, title, category, names, keybind)| SurfaceCommand {
            id: (*id).to_string(),
            title: (*title).to_string(),
            category: (*category).to_string(),
            slash: names.first().map(|item| (*item).to_string()),
            aliases: names
                .iter()
                .skip(1)
                .map(|item| (*item).to_string())
                .collect(),
            usage: None,
            keybind: keybind.map(str::to_string),
            description: None,
            source: CommandSource::Ui,
        })
        .collect();
    let mut capabilities = HashMap::new();
    capabilities.insert(String::from("android.runtime"), true);
    capabilities.insert(String::from("terminal.mouse"), false);
    let mut manifest = SurfaceManifest {
        commands,
        keybinds,
        capabilities,
    };
    apply_linux_command_parity(&mut manifest);
    manifest
}

fn ui_command(
    id: &str,
    title: &str,
    category: &str,
    names: &[&str],
    keybind: Option<&str>,
    description: Option<&str>,
) -> SurfaceCommand {
    SurfaceCommand {
        id: id.to_string(),
        title: title.to_string(),
        category: category.to_string(),
        slash: names.first().map(|item| (*item).to_string()),
        aliases: names
            .iter()
            .skip(1)
            .map(|item| (*item).to_string())
            .collect(),
        usage: None,
        keybind: keybind.map(str::to_string),
        description: description.map(str::to_string),
        source: CommandSource::Ui,
    }
}

fn apply_linux_command_parity(manifest: &mut SurfaceManifest) {
    let commands = [
        ui_command(
            "session.list",
            "Switch session",
            "Session",
            &["session", "sessions", "resume", "continue"],
            Some("session_list"),
            None,
        ),
        ui_command(
            "session.new",
            "New session",
            "Session",
            &["new", "clear"],
            Some("session_new"),
            None,
        ),
        ui_command(
            "workspace.list",
            "Workspaces",
            "Session",
            &["workspaces", "workspace"],
            None,
            None,
        ),
        ui_command(
            "session.title",
            "Rename session",
            "Session",
            &["rename", "title"],
            Some("session_rename"),
            None,
        ),
        ui_command(
            "session.warp",
            "Move session",
            "Session",
            &["move", "warp"],
            None,
            None,
        ),
        ui_command(
            "session.history.toggle",
            "History mode",
            "Session",
            &["history"],
            None,
            None,
        ),
        ui_command(
            "session.revert",
            "Undo previous message",
            "Session",
            &["undo", "revert"],
            Some("messages_undo"),
            None,
        ),
        ui_command(
            "session.unrevert",
            "Redo",
            "Session",
            &["redo", "unrevert"],
            Some("messages_redo"),
            None,
        ),
        ui_command(
            "sidebar.files",
            "Open file explorer",
            "Workspace",
            &["files", "explorer"],
            Some("session_files"),
            None,
        ),
        ui_command(
            "session.compact",
            "Compact session",
            "Session",
            &["compact", "summarize"],
            Some("session_compact"),
            None,
        ),
        ui_command(
            "session.toggle.timestamps",
            "Show timestamps",
            "Session",
            &["timestamps", "toggle-timestamps"],
            None,
            None,
        ),
        ui_command(
            "session.toggle.thinking",
            "Show thinking",
            "Session",
            &["thinking", "toggle-thinking"],
            Some("display_thinking"),
            None,
        ),
        ui_command(
            "model.completion.list",
            "Autocomplete model overrides",
            "Agent",
            &["models-completion"],
            None,
            None,
        ),
        ui_command(
            "variant.list",
            "Switch model variant",
            "Agent",
            &["variants"],
            Some("variant_list"),
            None,
        ),
        ui_command("mcp.list", "Toggle MCPs", "Agent", &["mcps"], None, None),
        ui_command(
            "console.orgs",
            "Switch console org",
            "Provider",
            &["orgs", "console"],
            None,
            None,
        ),
        ui_command(
            "shell.list",
            "Switch shell",
            "System",
            &["shells", "shell"],
            None,
            None,
        ),
        ui_command("prompt.skills", "Skills", "Prompt", &["skills"], None, None),
        ui_command(
            "prompt.editor",
            "Open editor",
            "Prompt",
            &["editor"],
            Some("editor_open"),
            None,
        ),
        ui_command(
            "app.exit",
            "Exit the app",
            "System",
            &["exit", "quit", "q"],
            None,
            None,
        ),
        ui_command(
            "session.resume",
            "Resume paused session",
            "Session",
            &["resume-session", "continue-session"],
            None,
            Some("Android compatibility command; Linux /resume switches sessions"),
        ),
    ];
    for command in commands {
        manifest.upsert(command);
    }
    if let Some(shell) = manifest
        .commands
        .iter_mut()
        .find(|item| item.id == "prompt.shell")
    {
        shell.slash = Some(String::from("shell-mode"));
        shell.aliases = vec![String::from("toggle-shell")];
        shell.description = Some(String::from(
            "Android compatibility command; Linux /shell opens shell selection",
        ));
    }
    if let Some(plugins) = manifest
        .commands
        .iter_mut()
        .find(|item| item.id == "plugins.list")
    {
        plugins.aliases.retain(|alias| alias != "mcps");
    }
}

fn load_manifest(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let body = client.json("GET", "/tui/manifest?platform=android", None)?;
    let mut manifest = fallback_manifest();
    let mut loaded_commands = 0;
    if let Some(commands) = body.get("commands").and_then(Value::as_array) {
        for item in commands {
            let slash = item.get("slash").unwrap_or(&Value::Null);
            let Some(id) = string(item, "id") else {
                continue;
            };
            loaded_commands += 1;
            manifest.upsert(SurfaceCommand {
                id,
                title: string(item, "title").unwrap_or_else(|| String::from("Command")),
                category: string(item, "category").unwrap_or_else(|| String::from("General")),
                slash: string(slash, "name"),
                aliases: slash
                    .get("aliases")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .filter_map(Value::as_str)
                            .map(str::to_string)
                            .collect()
                    })
                    .unwrap_or_default(),
                usage: string(slash, "usage"),
                keybind: string(item, "keybind"),
                description: string(item, "description"),
                source: CommandSource::Ui,
            });
        }
    }
    if let Some(map) = body.get("keybinds").and_then(Value::as_object) {
        for (key, value) in map {
            if let Some(value) = value.as_str() {
                manifest.keybinds.insert(key.clone(), value.to_string());
            }
        }
    }
    if let Some(map) = body.get("capabilities").and_then(Value::as_object) {
        for (key, value) in map {
            if let Some(value) = value.as_bool() {
                manifest.capabilities.insert(key.clone(), value);
            }
        }
    }
    if loaded_commands == 0 {
        return Err(String::from("shared TUI manifest had no commands"));
    }
    apply_linux_command_parity(&mut manifest);
    state.lock().map_err(|_| "state lock failed")?.manifest = manifest;
    Ok(())
}

fn load_daemon_commands(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let body = client.json("GET", "/command", None)?;
    let Some(items) = body.as_array() else {
        return Err(String::from("command list was not an array"));
    };
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    for item in items {
        let Some(name) = string(item, "name") else {
            continue;
        };
        if locked.manifest.has_name(&name) {
            continue;
        }
        let source = string(item, "source").unwrap_or_else(|| String::from("command"));
        let category = match source.as_str() {
            "skill" => "Skill",
            "mcp" => "MCP",
            _ => "Command",
        };
        locked.manifest.commands.push(SurfaceCommand {
            id: format!("prompt.{name}"),
            title: format!("/{name}"),
            category: category.to_string(),
            slash: Some(name),
            aliases: Vec::new(),
            usage: None,
            keybind: None,
            description: string(item, "description"),
            source: CommandSource::Prompt,
        });
    }
    Ok(())
}

fn hydrate_surface_snapshot(
    client: &Client,
    state: &Arc<Mutex<State>>,
    session: Option<&str>,
) -> Result<(), String> {
    let path = match session {
        Some(session) => format!("/tui/snapshot?sessionID={}", encode_query(session)),
        None => String::from("/tui/snapshot"),
    };
    let body = client.json("GET", &path, None)?;
    apply_surface_snapshot(state, &body)
}

fn hydrate_surface_frame(
    client: &Client,
    state: &Arc<Mutex<State>>,
    session: Option<&str>,
    width: u16,
    height: u16,
) -> Result<(), String> {
    let mut path = format!("/tui/frame?width={width}&height={height}");
    if let Some(session) = session {
        path.push_str("&sessionID=");
        path.push_str(&encode_query(session));
    }
    let body = client.json("GET", &path, None)?;
    apply_surface_frame(state, &body)
}

fn apply_surface_frame(state: &Arc<Mutex<State>>, body: &Value) -> Result<(), String> {
    if body
        .get("renderer")
        .and_then(Value::as_str)
        .is_some_and(|item| item != "shared/terminal-frame")
    {
        return Err(String::from("unsupported shared frame renderer"));
    }
    let mut lines = string_array(body.get("lines").unwrap_or(&Value::Null));
    if lines.is_empty() {
        return Err(String::from("shared frame had no lines"));
    }
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    let session_id = string(body, "sessionID");
    if let Some(id) = session_id.as_deref() {
        locked.session = Some(id.to_string());
    }
    locked.title = string(body, "title").unwrap_or_else(|| locked.title.clone());
    locked.status = string(body, "status").unwrap_or_else(|| locked.status.clone());
    locked.surface_frame = Some(lines);
    locked.surface_hydrated = true;
    Ok(())
}

fn apply_surface_snapshot(state: &Arc<Mutex<State>>, body: &Value) -> Result<(), String> {
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.surface_frame = None;
    locked.surface_hydrated = false;
    if let Some(id) = string(body, "sessionID") {
        locked.session = Some(id);
    }
    locked.title = string(body, "title")
        .or_else(|| {
            body.get("header")
                .and_then(|header| string(header, "title"))
        })
        .unwrap_or_else(|| locked.title.clone());
    locked.status = string(body, "status").unwrap_or_else(|| locked.status.clone());

    if let Some(footer) = body.get("footer") {
        if let Some(directory) = string(footer, "directory") {
            locked.footer_directory = directory;
        }
        locked.footer_workspace = string(footer, "workspaceID");
        locked.footer_lsp = usize_field(footer, "lsp");
        locked.footer_mcp = usize_field(footer, "mcp");
        locked.footer_mcp_failed = boolean(footer, "mcpFailed");
        locked.footer_permissions = usize_field(footer, "permissions");
    }

    if let Some(tabs) = body.get("tabs").and_then(Value::as_array) {
        locked.tabs.clear();
        for tab in tabs.iter().take(8) {
            let Some(id) = string(tab, "id") else {
                continue;
            };
            let title = string(tab, "title").unwrap_or_else(|| id.clone());
            if boolean(tab, "active") {
                locked.session = Some(id.clone());
                locked.title = title.clone();
            }
            locked.tabs.push(Tab { id, title });
        }
    }

    if let Some(items) = body.get("transcript").and_then(Value::as_array) {
        locked.messages.clear();
        locked.order.clear();
        for item in items {
            if let Some(message) = surface_message(item) {
                locked.push_message(message);
            }
        }
    }

    if let Some(sidebar) = body.get("sidebar") {
        if let Some(mode) = string(sidebar, "mode") {
            locked.sidebar_mode = if mode == "files" {
                SidebarMode::Files
            } else {
                SidebarMode::Summary
            };
        }
        let rows = string_array(sidebar.get("rows").unwrap_or(&Value::Null));
        if !rows.is_empty() {
            locked.sidebar_rows = rows;
        }
    }
    Ok(())
}

fn surface_message(item: &Value) -> Option<Message> {
    let id = string(item, "id")?;
    let role = string(item, "role").unwrap_or_else(|| String::from("assistant"));
    let text = string(item, "text").unwrap_or_default();
    let mut tools = Vec::new();
    if let Some(items) = item.get("tools").and_then(Value::as_array) {
        for tool in items {
            let name = string(tool, "tool").unwrap_or_else(|| String::from("tool"));
            let status = string(tool, "status").unwrap_or_else(|| String::from("pending"));
            let preview = string_array(tool.get("preview").unwrap_or(&Value::Null));
            let diff = string_array(tool.get("diff").unwrap_or(&Value::Null));
            let expandable = boolean(tool, "expandable");
            let row = if status == "completed" && expandable {
                format!("tool {name} {status} [expanded]")
            } else {
                format!("tool {name} {status}")
            };
            tools.push(row);
            for row in &preview {
                tools.push(format!("output {row}"));
            }
            if expandable && preview.len() >= 8 {
                tools.push(String::from("more line(s)"));
            }
            if !diff.is_empty() {
                tools.push(String::from("diff preview"));
            }
            for row in &diff {
                tools.push(format!("diff {row}"));
            }
            if expandable && diff.len() >= 14 {
                tools.push(String::from("more line(s)"));
            }
        }
    }
    Some(Message {
        id,
        role,
        text,
        tools,
    })
}

fn main() {
    if let Err(err) = run() {
        eprintln!("{err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let startup = Instant::now();
    startup_log(startup, "rust.start", json!({ "version": version() }));
    let args = parse()?;
    let client = Client {
        url: args.url.clone(),
        token: args.token.clone(),
    };
    let (width, height) = initial_terminal_size();
    let state = Arc::new(Mutex::new(State::new(args.clone(), width, height)));
    let dirty = Arc::new(AtomicBool::new(true));
    let done = Arc::new(AtomicBool::new(false));

    spawn_events(client.clone(), state.clone(), dirty.clone(), done.clone());
    spawn_startup(
        client.clone(),
        state.clone(),
        dirty.clone(),
        done.clone(),
        args,
        width,
        height,
        startup,
    );
    let result = terminal_loop(&client, state, dirty, done, startup);
    result
}

fn spawn_startup(
    client: Client,
    state: Arc<Mutex<State>>,
    dirty: Arc<AtomicBool>,
    done: Arc<AtomicBool>,
    args: Args,
    width: u16,
    height: u16,
    startup: Instant,
) {
    thread::spawn(move || {
        startup_log(
            startup,
            "hydrate.begin",
            json!({ "width": width, "height": height }),
        );
        if let Err(err) = load_manifest(&client, &state) {
            if let Ok(mut locked) = state.lock() {
                locked.notice(format!("shared manifest fallback: {err}"));
            }
        }
        if let Err(err) = load_daemon_commands(&client, &state) {
            if let Ok(mut locked) = state.lock() {
                locked.notice(format!("command list unavailable: {err}"));
            }
        }
        startup_log(startup, "manifest.done", json!({}));

        if args.cont {
            if let Ok(id) = last_session(&client) {
                if let Ok(mut locked) = state.lock() {
                    locked.session = Some(id);
                }
            }
        }
        let initial_session = args
            .session
            .clone()
            .or_else(|| state.lock().ok().and_then(|locked| locked.session.clone()));
        if let Some(session) = initial_session {
            hydrate_session(&client, &state, &session).ok();
        } else {
            hydrate_surface_snapshot(&client, &state, None).ok();
        }
        startup_log(startup, "snapshot.done", json!({}));

        if args.fork {
            if let Some(session) = state.lock().ok().and_then(|locked| locked.session.clone()) {
                if let Ok(forked) =
                    client.json("POST", &format!("/session/{session}/fork"), Some(json!({})))
                {
                    if let Some(id) = string(&forked, "id") {
                        if let Ok(mut locked) = state.lock() {
                            locked.session = Some(id.clone());
                        }
                        hydrate_session(&client, &state, &id).ok();
                    }
                }
            }
        }
        if let Some(prompt) = args.prompt.clone() {
            if ensure_session(&client, &state).is_ok() {
                submit_prompt(&client, &state, prompt).ok();
            }
        }

        let session = state.lock().ok().and_then(|locked| locked.session.clone());
        hydrate_surface_frame(&client, &state, session.as_deref(), width, height).ok();
        startup_log(startup, "frame.done", json!({}));
        dirty.store(true, Ordering::SeqCst);
        if done.load(Ordering::SeqCst) {
            startup_log(startup, "hydrate.after_exit", json!({}));
        }
    });
}

fn parse() -> Result<Args, String> {
    let mut args = Args::default();
    let raw: Vec<String> = env::args().skip(1).collect();
    if raw.first().map(|item| item.as_str()) == Some("--self-test") {
        println!("slopcode-android-tui ok");
        println!("slopcode-android-host ok");
        std::process::exit(0);
    }
    if raw.first().map(|item| item.as_str()) == Some("--version") {
        println!("{}", version());
        std::process::exit(0);
    }
    if raw.first().map(|item| item.as_str()) == Some("doctor") {
        doctor(&raw[1..])?;
        std::process::exit(0);
    }
    let mut iter = raw.into_iter();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--url" => args.url = iter.next().ok_or("missing --url value")?,
            "--token" => args.token = iter.next().ok_or("missing --token value")?,
            "--cwd" => args.cwd = iter.next(),
            "--view-id" => args.view_id = iter.next(),
            "--session" => args.session = iter.next(),
            "--continue" => args.cont = true,
            "--fork" => args.fork = true,
            "--model" => args.model = iter.next(),
            "--agent" => args.agent = iter.next(),
            "--prompt" => args.prompt = iter.next(),
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }
    if args.url.is_empty() {
        args.url = env::var("SLOPCODE_DAEMON_URL")
            .or_else(|_| env::var("SLOPCODE_SERVER_URL"))
            .unwrap_or_default();
    }
    if args.token.is_empty() {
        args.token = env::var("SLOPCODE_DAEMON_TOKEN")
            .or_else(|_| env::var("SLOPCODE_TOKEN"))
            .unwrap_or_default();
    }
    if args.url.is_empty() || args.token.is_empty() {
        bootstrap_daemon(&mut args)?;
    }
    if args.url.is_empty() {
        return Err(String::from("missing --url"));
    }
    if args.token.is_empty() {
        return Err(String::from("missing --token"));
    }
    Ok(args)
}

fn bootstrap_daemon(args: &mut Args) -> Result<(), String> {
    let entrypoint = env::var("SLOPCODE_ENTRYPOINT").map_err(|_| {
        String::from("missing --url; Android daemon bootstrap entrypoint is not configured")
    })?;
    let runner = env::var("SLOPCODE_ANDROID_BOOTSTRAP_RUNNER")
        .or_else(|_| env::var("SLOPCODE_BUN_PATH"))
        .unwrap_or_else(|_| String::from("bun"));
    let directory = args
        .cwd
        .clone()
        .or_else(|| {
            env::current_dir()
                .ok()
                .map(|item| item.display().to_string())
        })
        .unwrap_or_else(|| String::from("."));
    let token = id("tok");
    let port = available_port()?;
    let url = format!("http://127.0.0.1:{port}");
    let idle_timeout = env::var("SLOPCODE_DAEMON_IDLE_TIMEOUT_MS")
        .ok()
        .and_then(|item| item.parse::<u64>().ok())
        .unwrap_or(30 * 60 * 1000);
    let mut command = Command::new(&runner);
    command
        .arg(&entrypoint)
        .arg("daemon")
        .arg("run")
        .arg("--directory")
        .arg(&directory)
        .arg("--token")
        .arg(&token)
        .arg("--idle-timeout-ms")
        .arg(idle_timeout.to_string())
        .arg("--hostname")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .current_dir(&directory)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .env("SLOPCODE_BIONIC", "1")
        .env("SLOPCODE_DAEMON_CHILD", "1");
    if let Some(view_id) = &args.view_id {
        command.arg("--view-id").arg(view_id);
    }
    command
        .spawn()
        .map_err(|err| format!("failed to start Android daemon bootstrap {runner}: {err}"))?;
    wait_for_daemon(&url, &token, Duration::from_secs(45))?;
    args.url = url;
    args.token = token;
    if args.cwd.is_none() {
        args.cwd = Some(directory);
    }
    Ok(())
}

fn available_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|err| format!("failed to allocate daemon port: {err}"))?;
    let port = listener
        .local_addr()
        .map_err(|err| format!("failed to inspect daemon port: {err}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn wait_for_daemon(url: &str, token: &str, timeout: Duration) -> Result<(), String> {
    let client = Client {
        url: url.to_string(),
        token: token.to_string(),
    };
    let start = Instant::now();
    while start.elapsed() < timeout {
        if client.json("GET", "/daemon/status", None).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err(String::from(
        "timed out waiting for Android daemon bootstrap",
    ))
}

fn version() -> String {
    env::var("SLOPCODE_VERSION")
        .ok()
        .or_else(|| option_env!("SLOPCODE_BUILD_VERSION").map(|item| item.to_string()))
        .unwrap_or_else(|| String::from("dev"))
}

fn sidecar_path() -> String {
    if let Ok(path) = env::var("SLOPCODE_ANDROID_HOST_PATH") {
        return path;
    }
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join("slopcode-android-host").display().to_string();
        }
        return exe.display().to_string();
    }
    String::from("unknown")
}

fn doctor(raw: &[String]) -> Result<(), String> {
    if raw.first().map(|item| item.as_str()) != Some("android") {
        return Err(String::from("usage: slopcode doctor android [--json]"));
    }
    let sidecar = sidecar_path();
    let root = env::var("SLOPCODE_ANDROID_ROOT")
        .ok()
        .or_else(|| {
            env::current_exe()
                .ok()
                .and_then(|item| item.parent()?.parent().map(|dir| dir.display().to_string()))
        })
        .unwrap_or_else(|| String::from("unknown"));
    let exists = std::path::Path::new(&sidecar).exists();
    let clip_get = command_exists("termux-clipboard-get");
    let clip_set = command_exists("termux-clipboard-set");
    let termux_open = command_exists("termux-open");
    let termux_detected = env::var("TERMUX_VERSION").is_ok()
        || env::var("PREFIX").is_ok_and(|item| item.contains("/com.termux/"));
    let output = json!({
        "version": version(),
        "platform": env::consts::OS,
        "arch": env::consts::ARCH,
        "target": format!("{}-{}", env::consts::OS, env::consts::ARCH),
        "termux": termux_detected,
        "termuxDetected": termux_detected,
        "mode": "rust",
        "strategy": "rust",
        "renderer": "ratatui/crossterm",
        "targetRenderer": "ratatui/crossterm",
        "tuiCoreVersion": TUI_CORE_VERSION,
        "available": true,
        "reason": "rust-native Termux TUI",
        "root": root,
        "sidecar": sidecar,
        "sidecarExists": exists,
        "legacyFallbackAvailable": exists,
        "bun": Value::Null,
        "ffiBlocked": false,
        "mouse": false,
        "termuxApi": {
            "clipboard": clip_get && clip_set,
            "clipboardGet": clip_get,
            "clipboardSet": clip_set,
            "open": termux_open
        },
        "clipboardBackend": if clip_get && clip_set { "termux-api-command" } else { "terminal-paste" },
    });
    if raw.iter().any(|item| item == "--json") {
        println!("{output}");
        return Ok(());
    }
    println!("Android runtime: rust");
    println!("version: {}", version());
    println!("renderer: ratatui/crossterm");
    println!("tui core: {TUI_CORE_VERSION}");
    println!("sidecar: {sidecar}");
    println!("sidecar exists: {exists}");
    println!("termux api clipboard: {}", clip_get && clip_set);
    println!("termux open: {termux_open}");
    Ok(())
}

fn terminal_loop(
    client: &Client,
    state: Arc<Mutex<State>>,
    dirty: Arc<AtomicBool>,
    done: Arc<AtomicBool>,
    startup: Instant,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    thread::spawn(move || {
        let mut stdin = io::stdin();
        let mut buf = [0u8; 256];
        loop {
            match stdin.read(&mut buf) {
                Ok(0) => {
                    let _ = tx.send(Vec::new());
                    break;
                }
                Ok(n) => {
                    if tx.send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Err(_) => {
                    let _ = tx.send(Vec::new());
                    break;
                }
            }
        }
    });

    let mut stdout = io::stdout();
    let interactive = stdout.is_terminal();
    let raw = interactive && enable_raw_mode().is_ok();
    let alt = interactive && execute!(stdout, EnterAlternateScreen, Hide).is_ok();
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = if interactive {
        Terminal::new(backend).map_err(|err| err.to_string())?
    } else {
        Terminal::with_options(
            backend,
            TerminalOptions {
                viewport: Viewport::Fixed(Rect::new(
                    0,
                    0,
                    env_u16("COLUMNS", 80),
                    env_u16("LINES", 24),
                )),
            },
        )
        .map_err(|err| err.to_string())?
    };
    let mut input = InputParser::default();
    let mut last_draw = Instant::now() - Duration::from_secs(1);
    let mut first_draw = true;

    while !done.load(Ordering::SeqCst) {
        match rx.recv_timeout(Duration::from_millis(24)) {
            Ok(bytes) if bytes.is_empty() => done.store(true, Ordering::SeqCst),
            Ok(bytes) => {
                for action in input.push(&bytes) {
                    handle_action(client, &state, &dirty, &done, action)?;
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(_) => done.store(true, Ordering::SeqCst),
        }
        if dirty.swap(false, Ordering::SeqCst) || last_draw.elapsed() >= Duration::from_millis(250)
        {
            let locked = state.lock().map_err(|_| "state lock failed")?;
            terminal
                .draw(|frame| render(frame, &locked))
                .map_err(|err| err.to_string())?;
            if first_draw {
                startup_log(
                    startup,
                    "first_frame",
                    json!({ "hydrated": locked.surface_hydrated }),
                );
                first_draw = false;
            }
            last_draw = Instant::now();
        }
    }

    if interactive {
        terminal.show_cursor().ok();
    }
    if alt {
        execute!(terminal.backend_mut(), Show, LeaveAlternateScreen).ok();
    }
    if raw {
        disable_raw_mode().ok();
    }
    Ok(())
}

#[derive(Clone, Debug)]
enum InputAction {
    Text(String),
    Command(String),
    Enter,
    Newline,
    Backspace,
    Delete,
    Left,
    Right,
    Home,
    End,
    LineHome,
    LineEnd,
    WordForward,
    WordBackward,
    DeleteWordForward,
    Up,
    Down,
    Tab,
    CtrlD,
    CtrlC,
    CtrlU,
    CtrlK,
    CtrlW,
    CtrlN,
    CtrlP,
    CtrlS,
    CtrlQ,
    Escape,
    F12,
    F13,
}

#[derive(Default)]
struct InputParser {
    paste: bool,
    leader: bool,
}

fn escape_sequence_len(rest: &str) -> usize {
    for (index, ch) in rest.char_indices().skip(2) {
        if ch.is_ascii_alphabetic() || ch == '~' {
            return index + ch.len_utf8();
        }
    }
    rest.len()
}

fn matching_sequence_len(rest: &str, sequences: &[&str]) -> Option<usize> {
    sequences
        .iter()
        .find_map(|sequence| rest.starts_with(*sequence).then_some(sequence.len()))
}

impl InputParser {
    fn push(&mut self, bytes: &[u8]) -> Vec<InputAction> {
        let text = String::from_utf8_lossy(bytes);
        let mut out = Vec::new();
        let mut index = 0;
        while index < text.len() {
            let rest = &text[index..];
            if rest.starts_with("\x1b[200~") {
                self.paste = true;
                index += "\x1b[200~".len();
                continue;
            }
            if rest.starts_with("\x1b[201~") {
                self.paste = false;
                index += "\x1b[201~".len();
                continue;
            }
            if !self.paste {
                if self.leader {
                    if rest.starts_with("\x1b[B") {
                        self.leader = false;
                        out.push(InputAction::Command(String::from("/children")));
                        index += 3;
                        continue;
                    }
                    if rest.starts_with("\x1b[") {
                        self.leader = false;
                        index += escape_sequence_len(rest);
                        continue;
                    }
                }
                if let Some(len) =
                    matching_sequence_len(rest, &["\x1b[1;5C", "\x1b[1;3C", "\x1b[5C", "\x1b[3C"])
                {
                    out.push(InputAction::WordForward);
                    index += len;
                    continue;
                }
                if let Some(len) =
                    matching_sequence_len(rest, &["\x1b[1;5D", "\x1b[1;3D", "\x1b[5D", "\x1b[3D"])
                {
                    out.push(InputAction::WordBackward);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1b[3;5~", "\x1b[3;3~"]) {
                    out.push(InputAction::DeleteWordForward);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1b[3;2~"]) {
                    out.push(InputAction::Delete);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1bf", "\x1bF", "\x1b[1;9C"]) {
                    out.push(InputAction::WordForward);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1bb", "\x1bB", "\x1b[1;9D"]) {
                    out.push(InputAction::WordBackward);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1bd", "\x1bD"]) {
                    out.push(InputAction::DeleteWordForward);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1b\x7f", "\x1b\u{8}"]) {
                    out.push(InputAction::CtrlW);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1ba", "\x1bA"]) {
                    out.push(InputAction::LineHome);
                    index += len;
                    continue;
                }
                if let Some(len) = matching_sequence_len(rest, &["\x1be", "\x1bE"]) {
                    out.push(InputAction::LineEnd);
                    index += len;
                    continue;
                }
                if rest.starts_with("\x1b[A") {
                    out.push(InputAction::Up);
                    index += 3;
                    continue;
                }
                if rest.starts_with("\x1b[B") {
                    out.push(InputAction::Down);
                    index += 3;
                    continue;
                }
                if rest.starts_with("\x1b[C") {
                    out.push(InputAction::Right);
                    index += 3;
                    continue;
                }
                if rest.starts_with("\x1b[D") {
                    out.push(InputAction::Left);
                    index += 3;
                    continue;
                }
                if rest.starts_with("\x1b[3~") {
                    out.push(InputAction::Delete);
                    index += 4;
                    continue;
                }
                if rest.starts_with("\x1b[H") || rest.starts_with("\x1b[1~") {
                    out.push(InputAction::Home);
                    index += if rest.starts_with("\x1b[H") { 3 } else { 4 };
                    continue;
                }
                if rest.starts_with("\x1b[F") || rest.starts_with("\x1b[4~") {
                    out.push(InputAction::End);
                    index += if rest.starts_with("\x1b[F") { 3 } else { 4 };
                    continue;
                }
                if rest.starts_with("\x1b[24~") {
                    out.push(InputAction::F12);
                    index += 5;
                    continue;
                }
                if rest.starts_with("\x1b[25~") {
                    out.push(InputAction::F13);
                    index += 5;
                    continue;
                }
            }
            let Some(ch) = rest.chars().next() else {
                break;
            };
            index += ch.len_utf8();
            if !self.paste && self.leader {
                self.leader = false;
                match ch.to_ascii_lowercase() {
                    'f' => out.push(InputAction::Command(String::from("/files"))),
                    'l' => out.push(InputAction::Command(String::from("/sessions"))),
                    'm' => out.push(InputAction::Command(String::from("/models"))),
                    's' => out.push(InputAction::Command(String::from("/status"))),
                    'n' => out.push(InputAction::Command(String::from("/new"))),
                    'g' => out.push(InputAction::Command(String::from("/timeline"))),
                    'b' => out.push(InputAction::Command(String::from("/summary"))),
                    'c' => out.push(InputAction::Command(String::from("/compact"))),
                    'u' => out.push(InputAction::Command(String::from("/undo"))),
                    'r' => out.push(InputAction::Command(String::from("/redo"))),
                    'a' => out.push(InputAction::Command(String::from("/agents"))),
                    'e' => out.push(InputAction::Command(String::from("/editor"))),
                    't' => out.push(InputAction::Command(String::from("/themes"))),
                    'h' => out.push(InputAction::Command(String::from("/help"))),
                    ']' | '[' => out.push(InputAction::Command(String::from("/tabs"))),
                    'q' => out.push(InputAction::CtrlD),
                    '\u{18}' => self.leader = true,
                    _ => {}
                }
                continue;
            }
            match ch {
                '\u{1}' => out.push(InputAction::LineHome),
                '\u{2}' => out.push(InputAction::Left),
                '\u{4}' => out.push(InputAction::CtrlD),
                '\u{5}' => out.push(InputAction::LineEnd),
                '\u{6}' => out.push(InputAction::Right),
                '\u{3}' => out.push(InputAction::CtrlC),
                '\u{15}' => out.push(InputAction::CtrlU),
                '\u{0b}' => out.push(InputAction::CtrlK),
                '\u{17}' => out.push(InputAction::CtrlW),
                '\u{0e}' => out.push(InputAction::CtrlN),
                '\u{10}' => out.push(InputAction::CtrlP),
                '\u{13}' => out.push(InputAction::CtrlS),
                '\u{11}' => out.push(InputAction::CtrlQ),
                '\u{18}' if !self.paste => self.leader = true,
                '\u{1b}' if !self.paste => out.push(InputAction::Escape),
                '\u{1a}' if !self.paste => out.push(InputAction::Command(String::from("/suspend"))),
                '\r' if !self.paste => out.push(InputAction::Enter),
                '\n' if !self.paste => out.push(InputAction::Newline),
                '\u{7f}' | '\u{8}' => out.push(InputAction::Backspace),
                '\t' => out.push(InputAction::Tab),
                ch => out.push(InputAction::Text(ch.to_string())),
            }
        }
        out
    }
}

fn handle_action(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    done: &Arc<AtomicBool>,
    action: InputAction,
) -> Result<(), String> {
    let mut submit = None;
    let mut permission_replies = Vec::new();
    let mut question_reply = None;
    let mut question_rejection = None;
    let mut editor_messages = Vec::new();
    let mut save_editor = false;
    let mut dismiss_diff = false;
    let mut command_input = None;
    let mut open_palette = false;

    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        if let Some(permission) = locked.permission.clone() {
            if permission.reject_reason.is_none() && !locked.input.text.is_empty() {
                let queued = locked.input.clear();
                let queued_reply = match queued.as_str() {
                    "a" => Some((String::from("always"), None)),
                    "o" => Some((String::from("once"), None)),
                    value if value.starts_with('r') => Some((
                        String::from("reject"),
                        Some(value.trim_start_matches('r').trim().to_string()),
                    )),
                    _ => None,
                };
                if let Some((reply, reason)) = queued_reply {
                    let targets = permission_reply_targets(&locked);
                    let ids = targets
                        .iter()
                        .map(|item| item.id.clone())
                        .collect::<Vec<_>>();
                    permission_replies.extend(
                        targets
                            .into_iter()
                            .map(|item| (item.id, item.session, reply.clone(), reason.clone())),
                    );
                    permission_remove(&mut locked, &ids);
                }
            }
            if permission_replies.is_empty() {
                match (&permission.reject_reason, action) {
                    (Some(_), InputAction::Text(text)) => {
                        if let Some(item) = permission_focused_mut(&mut locked) {
                            item.reject_reason
                                .get_or_insert_with(String::new)
                                .push_str(&text);
                        }
                        sync_permission_focus(&mut locked);
                    }
                    (Some(_), InputAction::Backspace) => {
                        if let Some(item) = permission_focused_mut(&mut locked) {
                            item.reject_reason.get_or_insert_with(String::new).pop();
                        }
                        sync_permission_focus(&mut locked);
                    }
                    (Some(_), InputAction::CtrlU) => {
                        if let Some(item) = permission_focused_mut(&mut locked) {
                            item.reject_reason = Some(String::new());
                        }
                        sync_permission_focus(&mut locked);
                    }
                    (Some(reason), InputAction::Enter) => {
                        let targets = permission_reply_targets(&locked);
                        let ids = targets
                            .iter()
                            .map(|item| item.id.clone())
                            .collect::<Vec<_>>();
                        permission_replies.extend(targets.into_iter().map(|item| {
                            (
                                item.id,
                                item.session,
                                String::from("reject"),
                                Some(reason.clone()),
                            )
                        }));
                        permission_remove(&mut locked, &ids);
                    }
                    (_, InputAction::Text(ref text)) if text == "o" || text == "a" => {
                        let reply = if text == "a" { "always" } else { "once" };
                        let targets = permission_reply_targets(&locked);
                        let ids = targets
                            .iter()
                            .map(|item| item.id.clone())
                            .collect::<Vec<_>>();
                        permission_replies.extend(
                            targets
                                .into_iter()
                                .map(|item| (item.id, item.session, reply.to_string(), None)),
                        );
                        permission_remove(&mut locked, &ids);
                    }
                    (_, InputAction::Text(ref text)) if text == "r" => {
                        if let Some(item) = permission_focused_mut(&mut locked) {
                            item.reject_reason = Some(String::new());
                        }
                        sync_permission_focus(&mut locked);
                        locked.notice("enter rejection reason");
                    }
                    (_, InputAction::Text(ref text)) if text == " " => {
                        permission_toggle_focused(&mut locked);
                    }
                    (_, InputAction::Text(ref text))
                        if (text == "n" || text == "j") && !locked.permissions.is_empty() =>
                    {
                        permission_move_focus(&mut locked, 1);
                    }
                    (_, InputAction::Text(ref text))
                        if (text == "p" || text == "k") && !locked.permissions.is_empty() =>
                    {
                        permission_move_focus(&mut locked, -1);
                    }
                    (_, InputAction::Up) => {
                        permission_move_focus(&mut locked, -1);
                    }
                    (_, InputAction::Down) => {
                        permission_move_focus(&mut locked, 1);
                    }
                    (_, InputAction::Tab) => {
                        permission_move_focus(&mut locked, 1);
                    }
                    (_, InputAction::CtrlD | InputAction::CtrlC | InputAction::Escape) => {
                        let targets = permission_reply_targets(&locked);
                        let ids = targets
                            .iter()
                            .map(|item| item.id.clone())
                            .collect::<Vec<_>>();
                        permission_replies.extend(
                            targets
                                .into_iter()
                                .map(|item| (item.id, item.session, String::from("reject"), None)),
                        );
                        permission_remove(&mut locked, &ids);
                    }
                    _ => {}
                }
            }
            dirty.store(true, Ordering::SeqCst);
            drop(locked);
            for (id, session, reply, reason) in permission_replies {
                let mut body = json!({ "reply": reply });
                if let Some(reason) = reason {
                    body["message"] = json!(reason);
                }
                client.json(
                    "POST",
                    &format!(
                        "/permission/{id}/reply?sessionID={}",
                        encode_query(&session)
                    ),
                    Some(body),
                )?;
            }
            return Ok(());
        }

        if locked.question.is_some() {
            let editing = locked
                .question
                .as_ref()
                .is_some_and(|question| question.editing);
            match action {
                InputAction::Enter => {
                    let body = if editing {
                        question_commit_custom(&mut locked)
                    } else {
                        let selected = locked
                            .question
                            .as_ref()
                            .map(|question| question.selected)
                            .unwrap_or_default();
                        question_pick_index(&mut locked, selected)
                    };
                    if let Some(body) = body {
                        question_reply = Some(body);
                    }
                }
                InputAction::Backspace => {
                    if let Some(question) = locked.question.as_mut() {
                        question.editing = question.editing || !question.input.text.is_empty();
                        question.input.backspace();
                    }
                }
                InputAction::Left => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.left();
                        } else {
                            question_move_tab(question, -1);
                        }
                    }
                }
                InputAction::Right => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.right();
                        } else {
                            question_move_tab(question, 1);
                        }
                    }
                }
                InputAction::LineHome => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.line_home();
                        } else {
                            question.selected = 0;
                        }
                    }
                }
                InputAction::LineEnd => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.line_end();
                        } else if let Some(item) = question.items.get(question.index) {
                            question.selected = question_option_count(item).saturating_sub(1);
                        }
                    }
                }
                InputAction::Home => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.home();
                        } else {
                            question.selected = 0;
                        }
                    }
                }
                InputAction::End => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.end();
                        } else if let Some(item) = question.items.get(question.index) {
                            question.selected = question_option_count(item).saturating_sub(1);
                        }
                    }
                }
                InputAction::Text(text) => {
                    if editing {
                        if let Some(question) = locked.question.as_mut() {
                            question.input.insert(&text);
                        }
                    } else {
                        let mut chars = text.chars();
                        let first = chars.next();
                        let single_char = first.is_some() && chars.next().is_none();
                        let mut handled = false;
                        if single_char {
                            match first.unwrap_or_default() {
                                'h' => {
                                    if let Some(question) = locked.question.as_mut() {
                                        question_move_tab(question, -1);
                                    }
                                    handled = true;
                                }
                                'l' => {
                                    if let Some(question) = locked.question.as_mut() {
                                        question_move_tab(question, 1);
                                    }
                                    handled = true;
                                }
                                'j' => {
                                    if let Some(question) = locked.question.as_mut() {
                                        question_move_selection(question, 1);
                                    }
                                    handled = true;
                                }
                                'k' => {
                                    if let Some(question) = locked.question.as_mut() {
                                        question_move_selection(question, -1);
                                    }
                                    handled = true;
                                }
                                digit if digit.is_ascii_digit() && digit != '0' => {
                                    let selected =
                                        digit.to_digit(10).unwrap_or_default().saturating_sub(1)
                                            as usize;
                                    if let Some(body) = question_pick_index(&mut locked, selected) {
                                        question_reply = Some(body);
                                    }
                                    handled = true;
                                }
                                _ => {}
                            }
                        }
                        if !handled && !question_start_custom_input(&mut locked, &text) {
                            locked.notice("use arrows, numbers, enter, or custom answer");
                        }
                    }
                }
                InputAction::Newline => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.insert("\n");
                        }
                    }
                }
                InputAction::Tab => {
                    if let Some(question) = locked.question.as_mut() {
                        question_move_tab(question, 1);
                    }
                }
                InputAction::Up | InputAction::CtrlP => {
                    if let Some(question) = locked.question.as_mut() {
                        if !question.editing {
                            question_move_selection(question, -1);
                        }
                    }
                }
                InputAction::Down | InputAction::CtrlN => {
                    if let Some(question) = locked.question.as_mut() {
                        if !question.editing {
                            question_move_selection(question, 1);
                        }
                    }
                }
                InputAction::CtrlU => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.kill_to_line_start();
                        }
                    }
                }
                InputAction::CtrlK => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.kill_to_line_end();
                        }
                    }
                }
                InputAction::CtrlW => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.delete_word_before();
                        }
                    }
                }
                InputAction::Delete => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.delete();
                        }
                    }
                }
                InputAction::WordForward => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.word_forward();
                        }
                    }
                }
                InputAction::WordBackward => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.word_backward();
                        }
                    }
                }
                InputAction::DeleteWordForward => {
                    if let Some(question) = locked.question.as_mut() {
                        if question.editing {
                            question.input.delete_word_after();
                        }
                    }
                }
                InputAction::CtrlD | InputAction::CtrlC | InputAction::Escape => {
                    question_rejection = question_reject(&mut locked);
                }
                _ => {}
            }
            dirty.store(true, Ordering::SeqCst);
            drop(locked);
            if let Some((id, session, body)) = question_reply {
                client.json(
                    "POST",
                    &format!("/question/{id}/reply?sessionID={}", encode_query(&session)),
                    Some(body),
                )?;
            }
            if let Some((id, session)) = question_rejection {
                client.json(
                    "POST",
                    &format!("/question/{id}/reject?sessionID={}", encode_query(&session)),
                    None,
                )?;
            }
            return Ok(());
        }

        if locked.editor_focus && locked.editor.is_some() {
            match action {
                InputAction::CtrlQ | InputAction::CtrlC => {
                    locked.editor_focus = false;
                }
                InputAction::CtrlK | InputAction::CtrlD => dismiss_diff = true,
                InputAction::CtrlU | InputAction::CtrlS => save_editor = true,
                InputAction::Enter => editor_messages.push(String::from("<CR>")),
                InputAction::Newline => editor_messages.push(String::from("\n")),
                InputAction::Backspace => editor_messages.push(String::from("<BS>")),
                InputAction::Tab => editor_messages.push(String::from("<Tab>")),
                InputAction::Text(text) => editor_messages.push(text),
                _ => {}
            }
            dirty.store(true, Ordering::SeqCst);
            drop(locked);
            if !editor_messages.is_empty() {
                if let Some((session, editor)) = active_editor(state)? {
                    for message in editor_messages {
                        client.editor_message(&session, &editor.id, &message)?;
                    }
                    if let Ok(snapshot) = editor_snapshot(client, &session, &editor) {
                        state.lock().map_err(|_| "state lock failed")?.editor = Some(snapshot);
                    }
                }
            }
            if save_editor {
                save_active_editor(client, state)?;
            }
            if dismiss_diff {
                dismiss_active_diff(client, state)?;
            }
            return Ok(());
        }

        if locked.command_palette.is_some() {
            match action {
                InputAction::Text(text) => {
                    if let Some(palette) = locked.command_palette.as_mut() {
                        palette.query.push_str(&text);
                        palette.selected = 0;
                    }
                }
                InputAction::Backspace => {
                    if let Some(palette) = locked.command_palette.as_mut() {
                        palette.query.pop();
                        palette.selected = 0;
                    }
                }
                InputAction::CtrlU => {
                    if let Some(palette) = locked.command_palette.as_mut() {
                        palette.query.clear();
                        palette.selected = 0;
                    }
                }
                InputAction::Up | InputAction::CtrlP => {
                    let query = locked
                        .command_palette
                        .as_ref()
                        .map(|palette| palette.query.clone())
                        .unwrap_or_default();
                    let count = locked.manifest.command_matches(&query).len();
                    if count > 0 {
                        if let Some(palette) = locked.command_palette.as_mut() {
                            palette.selected = if palette.selected == 0 {
                                count - 1
                            } else {
                                palette.selected - 1
                            };
                        }
                    }
                }
                InputAction::Down | InputAction::CtrlN => {
                    let query = locked
                        .command_palette
                        .as_ref()
                        .map(|palette| palette.query.clone())
                        .unwrap_or_default();
                    let count = locked.manifest.command_matches(&query).len();
                    if count > 0 {
                        if let Some(palette) = locked.command_palette.as_mut() {
                            palette.selected = (palette.selected + 1) % count;
                        }
                    }
                }
                InputAction::Home => {
                    if let Some(palette) = locked.command_palette.as_mut() {
                        palette.selected = 0;
                    }
                }
                InputAction::End => {
                    let query = locked
                        .command_palette
                        .as_ref()
                        .map(|palette| palette.query.clone())
                        .unwrap_or_default();
                    let count = locked.manifest.command_matches(&query).len();
                    if count > 0 {
                        if let Some(palette) = locked.command_palette.as_mut() {
                            palette.selected = count - 1;
                        }
                    }
                }
                InputAction::Enter => {
                    let selected = locked.command_palette.as_ref().and_then(|palette| {
                        let matches = locked.manifest.command_matches(&palette.query);
                        matches
                            .get(palette.selected.min(matches.len().saturating_sub(1)))
                            .cloned()
                    });
                    locked.command_palette = None;
                    if let Some(command) = selected {
                        let name = command
                            .slash
                            .clone()
                            .or_else(|| command.aliases.first().cloned())
                            .unwrap_or(command.id);
                        command_input = Some(format!("/{name}"));
                    } else {
                        locked.notice("no command selected");
                    }
                }
                InputAction::Command(input) => {
                    locked.command_palette = None;
                    command_input = Some(input);
                }
                InputAction::CtrlD | InputAction::CtrlC | InputAction::Escape => {
                    locked.command_palette = None;
                }
                InputAction::CtrlK
                | InputAction::CtrlW
                | InputAction::CtrlS
                | InputAction::CtrlQ
                | InputAction::Newline
                | InputAction::LineHome
                | InputAction::LineEnd
                | InputAction::WordForward
                | InputAction::WordBackward
                | InputAction::DeleteWordForward
                | InputAction::Delete
                | InputAction::Left
                | InputAction::Right
                | InputAction::Tab
                | InputAction::F12
                | InputAction::F13 => {}
            }
            dirty.store(true, Ordering::SeqCst);
            drop(locked);
            if let Some(input) = command_input {
                command(client, state, &input)?;
            }
            return Ok(());
        }

        match action {
            InputAction::CtrlD => {
                if locked.input.text.is_empty() {
                    done.store(true, Ordering::SeqCst);
                } else {
                    locked.input.delete();
                }
            }
            InputAction::CtrlC => {
                if locked.input.text.is_empty() {
                    done.store(true, Ordering::SeqCst);
                } else {
                    locked.input = Buffer::default();
                }
            }
            InputAction::CtrlU => locked.input.kill_to_line_start(),
            InputAction::CtrlK => locked.input.kill_to_line_end(),
            InputAction::CtrlW => locked.input.delete_word_before(),
            InputAction::CtrlN => {}
            InputAction::Backspace => locked.input.backspace(),
            InputAction::Delete => locked.input.delete(),
            InputAction::Left => locked.input.left(),
            InputAction::Right => locked.input.right(),
            InputAction::Home => locked.input.home(),
            InputAction::End => locked.input.end(),
            InputAction::LineHome => locked.input.line_home(),
            InputAction::LineEnd => locked.input.line_end(),
            InputAction::WordForward => locked.input.word_forward(),
            InputAction::WordBackward => locked.input.word_backward(),
            InputAction::DeleteWordForward => locked.input.delete_word_after(),
            InputAction::Up => locked.history_prev(),
            InputAction::Down => locked.history_next(),
            InputAction::Tab => complete_command(&mut locked),
            InputAction::CtrlP => open_palette = true,
            InputAction::Command(input) => command_input = Some(input),
            InputAction::Escape => {}
            InputAction::F12 => {
                let text = locked.input.clear();
                if !text.is_empty() {
                    locked.stash.push(text);
                    locked.notice("stashed prompt");
                }
            }
            InputAction::F13 => {
                if let Some(text) = locked.stash.pop() {
                    locked.input.set(text);
                    locked.notice("restored stashed prompt");
                }
            }
            InputAction::Enter => {
                let text = locked.input.clear();
                locked.history_index = None;
                if !text.trim().is_empty() {
                    locked.history.push(text.clone());
                    submit = Some(text);
                }
            }
            InputAction::CtrlS | InputAction::CtrlQ => {}
            InputAction::Newline => locked.input.insert("\n"),
            InputAction::Text(text) => locked.input.insert(&text),
        }
    }

    dirty.store(true, Ordering::SeqCst);
    if open_palette {
        let load_error = load_daemon_commands(client, state).err();
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        if let Some(err) = load_error {
            locked.notice(format!("command list unavailable: {err}"));
        }
        locked.command_palette();
    }
    if let Some(input) = command_input {
        command(client, state, &input)?;
    }
    if let Some(text) = submit {
        let trimmed = text.trim().to_string();
        if trimmed == "/exit" || trimmed == "/quit" || trimmed == "/q" {
            done.store(true, Ordering::SeqCst);
        } else if trimmed.starts_with('/') {
            command(client, state, &trimmed)?;
        } else {
            ensure_session(client, state)?;
            if state.lock().map_err(|_| "state lock failed")?.shell {
                submit_shell(client, state, trimmed)?;
            } else {
                submit_prompt(client, state, text)?;
            }
        }
    }
    Ok(())
}

fn complete_command(state: &mut State) {
    let text = state.input.text.clone();
    if !text.starts_with('/') {
        return;
    }
    let matches: Vec<String> = state
        .manifest
        .command_names()
        .into_iter()
        .filter(|cmd| cmd.starts_with(text.trim()))
        .collect();
    if matches.len() == 1 {
        state.input.set(matches[0].clone());
        state.input.insert(" ");
    } else if !matches.is_empty() {
        state.panel("Command Matches", matches);
    }
}

fn command(client: &Client, state: &Arc<Mutex<State>>, input: &str) -> Result<(), String> {
    let (name, value) = input
        .trim_start_matches('/')
        .split_once(' ')
        .map(|(a, b)| (a.trim(), b.trim()))
        .unwrap_or_else(|| (input.trim_start_matches('/'), ""));
    let mut resolved = state
        .lock()
        .map_err(|_| "state lock failed")?
        .manifest
        .find(name);
    if resolved.is_none() {
        load_daemon_commands(client, state).ok();
        resolved = state
            .lock()
            .map_err(|_| "state lock failed")?
            .manifest
            .find(name);
    }
    let Some(command) = resolved else {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        let prefix = format!("/{name}");
        let matches = locked
            .manifest
            .command_names()
            .into_iter()
            .filter(|cmd| cmd.starts_with(&prefix))
            .collect::<Vec<_>>();
        if !matches.is_empty() {
            locked.input.set(input.to_string());
            locked.panel("Command Matches", matches);
            return Ok(());
        }
        locked.notice(format!("unknown command /{name}"));
        return Ok(());
    };
    if command.source == CommandSource::Prompt {
        let prompt_command = command.slash.as_deref().unwrap_or(name);
        return submit_prompt_command(client, state, prompt_command, value);
    }
    execute_ui_command(client, state, &command, name, value)
}

fn execute_ui_command(
    client: &Client,
    state: &Arc<Mutex<State>>,
    command: &SurfaceCommand,
    name: &str,
    value: &str,
) -> Result<(), String> {
    match command.id.as_str() {
        "help.show" => {
            load_daemon_commands(client, state).ok();
            let mut rows = state
                .lock()
                .map_err(|_| "state lock failed")?
                .manifest
                .command_rows(value);
            rows.insert(0, String::from("Command Palette"));
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Command Palette", rows);
        }
        "session.new" => {
            let id = create_session(client)?;
            {
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.session = Some(id.clone());
                locked.messages.clear();
                locked.order.clear();
                locked.panel = None;
                locked.notice(format!("session {id}"));
            }
            hydrate_session(client, state, &id).ok();
        }
        "session.list" => {
            if value.is_empty() {
                sessions_panel(client, state)?;
            } else {
                state.lock().map_err(|_| "state lock failed")?.session = Some(value.to_string());
                hydrate_session(client, state, value).ok();
            }
        }
        "workspace.list" => workspaces_panel(client, state)?,
        "session.tabs" => tabs_panel(state)?,
        "session.children" => {
            let session = ensure_session(client, state)?;
            let body = client.json("GET", &format!("/session/{session}/children"), None)?;
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Child Sessions", rows_from_array(&body, &["id", "title"]));
        }
        "session.timeline" => {
            let session = ensure_session(client, state)?;
            hydrate_messages(client, state, &session)?;
            state.lock().map_err(|_| "state lock failed")?.panel = None;
        }
        "session.status" | "slopcode.status" => {
            let body = client.json("GET", "/session/status", None)?;
            let rows = if let Some(obj) = body.as_object() {
                obj.iter()
                    .map(|(key, value)| format!("{key}: {value}"))
                    .collect()
            } else {
                vec![body.to_string()]
            };
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Status", rows);
        }
        "model.list" => {
            if value.is_empty() {
                models_panel(client, state, "")?;
            } else if parse_model(value).is_some() {
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.model = Some(value.to_string());
                locked.notice(format!("model {value}"));
            } else {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice("usage: /model provider/model");
            }
        }
        "model.completion.list" => model_completion_panel(client, state, value)?,
        "variant.list" => variants_panel(client, state, value)?,
        "provider.list" | "provider.connect" => {
            let body = client.json("GET", "/v2/provider", None)?;
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Providers", rows_from_array(&body, &["id", "name", "type"]));
        }
        "console.orgs" => console_orgs_panel(client, state)?,
        "agent.list" => {
            if !value.is_empty() {
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.agent = Some(value.to_string());
                locked.notice(format!("agent {value}"));
            } else {
                state.lock().map_err(|_| "state lock failed")?.panel(
                    "Agents",
                    vec![
                        String::from("Use /agent <name> to set the active agent."),
                        String::from("Agent discovery is served by the daemon configuration."),
                    ],
                );
            }
        }
        "mcp.list" => mcp_panel(client, state)?,
        "sidebar.summary" | "session.sidebar.toggle" => summary_panel(client, state)?,
        "sidebar.files" | "session.files.open" => files_panel(client, state, value)?,
        "file.open" => open_file(client, state, value)?,
        "file.attach" => {
            if !value.is_empty() {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .attached
                    .push(value.to_string());
            }
        }
        "editor.focus" | "prompt.editor" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if locked.editor.is_some() {
                locked.editor_focus = true;
                locked.notice("input focus");
            } else {
                locked.notice("no active editor; use /open <file>");
            }
        }
        "editor.save" => save_active_editor(client, state)?,
        "editor.diagnostics" => diagnostics_panel(client, state)?,
        "editor.diff" => {
            if value == "dismiss" {
                dismiss_active_diff(client, state)?;
            } else {
                let session = ensure_session(client, state)?;
                let body = client.json("GET", &format!("/session/{session}/diff/index"), None)?;
                state.lock().map_err(|_| "state lock failed")?.panel(
                    "Diff",
                    rows_from_array(&body, &["file", "added", "removed"]),
                );
            }
        }
        "editor.close" => close_editor(client, state, name.ends_with('!'))?,
        "session.share" => session_action(client, state, "share", "POST")?,
        "session.unshare" => session_action(client, state, "share", "DELETE")?,
        "session.pause" => session_action(client, state, "pause", "POST")?,
        "session.resume" => session_action(client, state, "resume", "POST")?,
        "session.interrupt" => session_action(client, state, "abort", "POST")?,
        "session.revert" | "session.undo" => {
            if value.is_empty() {
                undo_last_message(client, state)?;
            } else {
                revert_session(client, state, value)?;
            }
        }
        "session.unrevert" | "session.redo" => session_action(client, state, "unrevert", "POST")?,
        "session.compact" => compact_session(client, state)?,
        "session.fork" => {
            let session = ensure_session(client, state)?;
            let body = client.json("POST", &format!("/session/{session}/fork"), Some(json!({})))?;
            if let Some(id) = string(&body, "id") {
                state.lock().map_err(|_| "state lock failed")?.session = Some(id.clone());
                hydrate_session(client, state, &id).ok();
            }
        }
        "session.close" => close_tab(state)?,
        "session.title" | "session.rename" => rename_session(client, state, value)?,
        "session.warp" => warp_session(client, state, value)?,
        "session.history.toggle" => history_mode_panel(state)?,
        "session.toggle.timestamps" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.show_timestamps = !locked.show_timestamps;
            let notice = if locked.show_timestamps {
                "timestamps shown"
            } else {
                "timestamps hidden"
            };
            locked.notice(notice);
        }
        "session.toggle.thinking" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.show_thinking = !locked.show_thinking;
            let notice = if locked.show_thinking {
                "thinking shown"
            } else {
                "thinking hidden"
            };
            locked.notice(notice);
        }
        "prompt.queue" => {
            let locked = state.lock().map_err(|_| "state lock failed")?;
            let rows = if locked.queue.is_empty() {
                vec![String::from("queue empty")]
            } else {
                locked.queue.clone()
            };
            drop(locked);
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Prompt Queue", rows);
        }
        "prompt.stash" => {
            let rows = {
                let locked = state.lock().map_err(|_| "state lock failed")?;
                if name == "pop" {
                    Vec::new()
                } else if locked.stash.is_empty() {
                    vec![String::from("stash empty")]
                } else {
                    locked.stash.clone()
                }
            };
            if name == "pop" {
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                if let Some(text) = locked.stash.pop() {
                    locked.input.set(text);
                }
            } else {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .panel("Prompt Stash", rows);
            }
        }
        "prompt.shell" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.shell = !locked.shell;
            let notice = if locked.shell {
                "shell mode on"
            } else {
                "shell mode off"
            };
            locked.notice(notice);
        }
        "shell.list" => shells_panel(client, state, value)?,
        "android.doctor" => android_runtime_panel(state)?,
        "theme.list" | "theme.switch" => themes_panel(state, value)?,
        "keybinds.list" => keybinds_panel(state)?,
        "clipboard.status" => clipboard_panel(state)?,
        "terminal.suspend" => state.lock().map_err(|_| "state lock failed")?.panel(
            "Suspend",
            vec![
                String::from("Ctrl-Z is handled by Termux and the parent shell."),
                String::from("Use Android app switching to background SlopCode."),
            ],
        ),
        "plugins.list" => plugins_panel(client, state)?,
        "prompt.skills" => {
            load_daemon_commands(client, state).ok();
            let rows = state
                .lock()
                .map_err(|_| "state lock failed")?
                .manifest
                .command_rows("Skill");
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Skills", rows);
        }
        "app.exit" => state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("exit requested"),
        _ => state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice(format!("unsupported command {}", command.id)),
    }
    Ok(())
}

fn submit_prompt_command(
    client: &Client,
    state: &Arc<Mutex<State>>,
    command: &str,
    arguments: &str,
) -> Result<(), String> {
    let session = ensure_session(client, state)?;
    let (model, agent, attached) = {
        let locked = state.lock().map_err(|_| "state lock failed")?;
        (
            locked.model.clone(),
            locked.agent.clone(),
            locked.attached.clone(),
        )
    };
    let mut parts = Vec::new();
    for file in attached {
        parts.push(json!({
            "id": id("prt"),
            "type": "file",
            "path": file,
        }));
    }
    let mut body = json!({
        "messageID": id("msg"),
        "command": command,
        "arguments": arguments,
        "parts": parts,
    });
    if let Some(model) = model {
        body["model"] = json!(model);
    }
    if let Some(agent) = agent {
        body["agent"] = json!(agent);
    }
    client.json("POST", &format!("/session/{session}/command"), Some(body))?;
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.attached.clear();
    locked.notice(format!("command /{command}"));
    Ok(())
}

fn workspaces_panel(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let body = client
        .json("GET", "/experimental/workspace", None)
        .unwrap_or_else(|_| json!([]));
    let mut rows = rows_from_array(&body, &["id", "name", "type", "directory"]);
    if rows.is_empty() {
        rows.push(String::from("No workspaces"));
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Workspaces", rows);
    Ok(())
}

fn mcp_panel(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let body = client
        .json("GET", "/mcp", None)
        .unwrap_or_else(|_| json!({}));
    let rows = if let Some(map) = body.as_object() {
        let mut rows = map
            .iter()
            .map(|(key, value)| format!("{key}: {value}"))
            .collect::<Vec<_>>();
        rows.sort();
        rows
    } else {
        vec![body.to_string()]
    };
    state.lock().map_err(|_| "state lock failed")?.panel(
        "MCPs",
        if rows.is_empty() {
            vec![String::from("No MCPs")]
        } else {
            rows
        },
    );
    Ok(())
}

fn rename_session(client: &Client, state: &Arc<Mutex<State>>, title: &str) -> Result<(), String> {
    if title.is_empty() {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("usage: /rename <title>");
        return Ok(());
    }
    let session = ensure_session(client, state)?;
    client.json(
        "PATCH",
        &format!("/session/{session}"),
        Some(json!({ "title": title })),
    )?;
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.title = title.to_string();
    locked.notice(format!("renamed {title}"));
    Ok(())
}

fn warp_session(client: &Client, state: &Arc<Mutex<State>>, workspace: &str) -> Result<(), String> {
    if workspace.is_empty() {
        return workspaces_panel(client, state);
    }
    let session = ensure_session(client, state)?;
    let body = client.json(
        "POST",
        "/experimental/workspace/warp",
        Some(json!({
            "sessionID": session,
            "id": workspace,
        })),
    )?;
    if let Some(title) = string(&body, "title") {
        state.lock().map_err(|_| "state lock failed")?.title = title;
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .notice(format!("moved session to {workspace}"));
    Ok(())
}

fn undo_last_message(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let session = ensure_session(client, state)?;
    let target = {
        let locked = state.lock().map_err(|_| "state lock failed")?;
        locked.order.iter().rev().find_map(|id| {
            let message = locked.messages.get(id)?;
            if message.role == "user" {
                Some((message.id.clone(), message.text.clone()))
            } else {
                None
            }
        })
    };
    let Some((message, text)) = target else {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("no user message to undo");
        return Ok(());
    };
    client.json(
        "POST",
        &format!("/session/{session}/revert"),
        Some(json!({ "messageID": message })),
    )?;
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    if !text.is_empty() {
        locked.input.set(text);
    }
    locked.notice("undid previous message");
    Ok(())
}

fn ensure_session(client: &Client, state: &Arc<Mutex<State>>) -> Result<String, String> {
    if let Some(session) = state
        .lock()
        .map_err(|_| "state lock failed")?
        .session
        .clone()
    {
        return Ok(session);
    }
    let id = create_session(client)?;
    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.session = Some(id.clone());
        locked.notice(format!("session {id}"));
    }
    hydrate_session(client, state, &id).ok();
    Ok(id)
}

fn create_session(client: &Client) -> Result<String, String> {
    let body = client.json("POST", "/session", Some(json!({})))?;
    string(&body, "id").ok_or_else(|| format!("failed to create session: {body}"))
}

fn last_session(client: &Client) -> Result<String, String> {
    let body = client.json("GET", "/session?roots=true&limit=1", None)?;
    body.as_array()
        .and_then(|items| items.first())
        .and_then(|item| string(item, "id"))
        .or_else(|| string(&body, "id"))
        .ok_or_else(|| String::from("no previous session found"))
}

fn hydrate_session(
    client: &Client,
    state: &Arc<Mutex<State>>,
    session: &str,
) -> Result<(), String> {
    if hydrate_surface_snapshot(client, state, Some(session)).is_ok() {
        return Ok(());
    }
    let body = client.json("GET", &format!("/session/{session}"), None)?;
    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.title = string(&body, "title").unwrap_or_else(|| String::from("SlopCode"));
        locked.session = Some(session.to_string());
        let title = locked.title.clone();
        locked.sync_tab(session, &title);
    }
    hydrate_messages(client, state, session)
}

fn hydrate_messages(
    client: &Client,
    state: &Arc<Mutex<State>>,
    session: &str,
) -> Result<(), String> {
    let body = client.json("GET", &format!("/session/{session}/message/index"), None)?;
    if let Some(items) = body.as_array() {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        for item in items {
            if let Some(id) = string(item, "id") {
                let role = string(item, "role").unwrap_or_else(|| String::from("assistant"));
                locked.push_message(Message {
                    id,
                    role,
                    text: String::new(),
                    tools: Vec::new(),
                });
            }
        }
    }
    if let Ok(chunks) = client.json("GET", &format!("/session/{session}/message/chunk"), None) {
        apply_chunks(state, &chunks);
    }
    Ok(())
}

fn submit_prompt(client: &Client, state: &Arc<Mutex<State>>, text: String) -> Result<(), String> {
    let session = ensure_session(client, state)?;
    let (model, agent, attached) = {
        let locked = state.lock().map_err(|_| "state lock failed")?;
        (
            locked.model.clone(),
            locked.agent.clone(),
            locked.attached.clone(),
        )
    };
    let mut parts = Vec::new();
    for file in attached {
        parts.push(json!({
            "id": id("prt"),
            "type": "file",
            "path": file,
        }));
    }
    parts.push(json!({
        "id": id("prt"),
        "type": "text",
        "text": text,
    }));
    let mut body = json!({
        "messageID": id("msg"),
        "parts": parts,
    });
    if let Some((provider, model)) = model.as_deref().and_then(parse_model) {
        body["model"] = json!({ "providerID": provider, "modelID": model });
    }
    if let Some(agent) = agent {
        body["agent"] = json!(agent);
    }
    client.json(
        "POST",
        &format!("/session/{session}/prompt_async"),
        Some(body),
    )?;
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .attached
        .clear();
    Ok(())
}

fn submit_shell(client: &Client, state: &Arc<Mutex<State>>, command: String) -> Result<(), String> {
    let session = ensure_session(client, state)?;
    let model = state.lock().map_err(|_| "state lock failed")?.model.clone();
    let mut body = json!({ "command": command });
    if let Some((provider, model)) = model.as_deref().and_then(parse_model) {
        body["model"] = json!({ "providerID": provider, "modelID": model });
    }
    client.json("POST", &format!("/session/{session}/shell"), Some(body))?;
    Ok(())
}

fn sessions_panel(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let body = client.json("GET", "/session?roots=true&limit=20", None)?;
    let rows = rows_from_array(&body, &["id", "title"]);
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    if let Some(items) = body.as_array() {
        for item in items {
            if let Some(id) = string(item, "id") {
                let title = string(item, "title").unwrap_or_else(|| id.clone());
                locked.sync_tab(&id, &title);
            }
        }
    }
    locked.panel("Sessions", rows);
    Ok(())
}

fn tabs_panel(state: &Arc<Mutex<State>>) -> Result<(), String> {
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    let current = locked.session.clone();
    let active_dirty = locked.editor.as_ref().is_some_and(|editor| editor.dirty);
    let active_editor = locked.editor.as_ref().map(|editor| editor.file.clone());
    if let Some(session) = current.as_deref() {
        let title = locked.title.clone();
        locked.sync_tab(session, &title);
    }
    let mut rows = if locked.tabs.is_empty() {
        Vec::new()
    } else {
        locked
            .tabs
            .iter()
            .enumerate()
            .map(|(index, tab)| {
                let active = current.as_deref() == Some(tab.id.as_str());
                let marker = if active { ">" } else { " " };
                let dirty = if active && active_dirty { " *" } else { "" };
                format!(
                    "{} {} {}{} [tab: /session {}] [close: /close]",
                    index + 1,
                    marker,
                    tab.title,
                    dirty,
                    tab.id
                )
            })
            .collect()
    };
    let start = rows.len();
    rows.extend(locked.open_files.iter().enumerate().map(|(index, file)| {
        let active = active_editor.as_deref() == Some(file.as_str());
        let marker = if active { ">" } else { " " };
        let dirty = if active && active_dirty { " *" } else { "" };
        format!(
            "{} {} Editor {}{} [tab: /open {}] [close: /close-editor]",
            start + index + 1,
            marker,
            file,
            dirty,
            file
        )
    }));
    if rows.is_empty() {
        rows.push(String::from("No open tabs"));
    }
    locked.panel("Tabs", rows);
    Ok(())
}

fn close_tab(state: &Arc<Mutex<State>>) -> Result<(), String> {
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    if let Some(current) = locked.session.clone() {
        locked.tabs.retain(|item| item.id != current);
        if let Some(next) = locked.tabs.last().cloned() {
            locked.session = Some(next.id.clone());
            locked.title = next.title;
            locked.notice("closed current tab");
        } else {
            locked.session = None;
            locked.title = String::from("Home");
            locked.messages.clear();
            locked.order.clear();
            locked.editor = None;
            locked.editor_focus = false;
            locked.panel = None;
            locked.surface_frame = None;
            locked.surface_hydrated = false;
            locked.notice("closed last tab");
        }
    } else {
        locked.notice("no active tab");
    }
    Ok(())
}

fn models_panel(client: &Client, state: &Arc<Mutex<State>>, query: &str) -> Result<(), String> {
    let body = client.json("GET", "/v2/model", None)?;
    let mut rows = rows_from_array(&body, &["providerID", "id", "name"]);
    if !query.is_empty() {
        rows.retain(|row| row.contains(query));
    }
    if rows.is_empty() {
        rows.push(String::from("No models found. Use /model provider/model."));
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Models", rows);
    Ok(())
}

fn model_completion_panel(
    client: &Client,
    state: &Arc<Mutex<State>>,
    value: &str,
) -> Result<(), String> {
    if !value.is_empty() {
        update_autocomplete_override(client, state, value)?;
    }
    let config = config_value(client);
    let providers = client
        .json("GET", "/v2/provider", None)
        .unwrap_or_else(|_| json!([]));
    let models = client
        .json("GET", "/v2/model", None)
        .unwrap_or_else(|_| json!([]));
    let mut rows = Vec::new();
    if let Some(items) = providers.as_array() {
        for provider in items {
            let Some(id) = string(provider, "id") else {
                continue;
            };
            let name = string(provider, "name").unwrap_or_else(|| id.clone());
            let count = provider
                .get("models")
                .and_then(Value::as_object)
                .map(|items| items.len())
                .unwrap_or_else(|| flat_model_count(&models, &id));
            rows.push(format!(
                "{name}  provider {id}  {}  {count} model(s)",
                autocomplete_override(&config, &id)
            ));
        }
    }
    if rows.is_empty() {
        for id in flat_provider_ids(&models) {
            rows.push(format!(
                "provider {id}  {}  {} model(s)",
                autocomplete_override(&config, &id),
                flat_model_count(&models, &id)
            ));
        }
    }
    if rows.is_empty() {
        rows.push(String::from("No autocomplete providers found"));
    } else {
        rows.insert(
            0,
            String::from("Use /models-completion <provider>/selected or <provider>/<model>"),
        );
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Autocomplete Model", rows);
    Ok(())
}

fn update_autocomplete_override(
    client: &Client,
    state: &Arc<Mutex<State>>,
    value: &str,
) -> Result<(), String> {
    let Some((provider, model)) = value.split_once('/') else {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("usage: /models-completion provider/selected|model");
        return Ok(());
    };
    if provider.is_empty() || model.is_empty() {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("usage: /models-completion provider/selected|model");
        return Ok(());
    }
    if model == "auto" {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("automatic autocomplete resets by removing the provider override from config");
        return Ok(());
    }
    let mut overrides = serde_json::Map::new();
    overrides.insert(
        provider.to_string(),
        if model == "selected" {
            Value::Null
        } else {
            Value::String(model.to_string())
        },
    );
    let next = json!({ "autocomplete": { "provider_model_overrides": Value::Object(overrides) } });
    client.json("PATCH", "/global/config", Some(next))?;
    client.json("POST", "/global/dispose", Some(json!({}))).ok();
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .notice(format!(
            "autocomplete {provider} {}",
            if model == "auto" {
                "automatic"
            } else if model == "selected" {
                "selected model"
            } else {
                model
            }
        ));
    Ok(())
}

fn variants_panel(client: &Client, state: &Arc<Mutex<State>>, value: &str) -> Result<(), String> {
    if !value.is_empty() {
        if parse_model(value).is_some() {
            state.lock().map_err(|_| "state lock failed")?.model = Some(value.to_string());
        } else if value != "default" {
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .notice(format!("variant {value}"));
        }
    }
    let config = config_value(client);
    let selected = state
        .lock()
        .map_err(|_| "state lock failed")?
        .model
        .clone()
        .or_else(|| string(&config, "model"));
    let Some(model_id) = selected else {
        state.lock().map_err(|_| "state lock failed")?.panel(
            "Variants",
            vec![String::from("Select a model before /variants")],
        );
        return Ok(());
    };
    let Some((provider, model)) = parse_model(&model_id) else {
        state.lock().map_err(|_| "state lock failed")?.panel(
            "Variants",
            vec![format!("Selected model has no provider prefix: {model_id}")],
        );
        return Ok(());
    };
    let providers = client
        .json("GET", "/v2/provider", None)
        .unwrap_or_else(|_| json!([]));
    let models = client
        .json("GET", "/v2/model", None)
        .unwrap_or_else(|_| json!([]));
    let variants = model_variants(&providers, &models, &provider, &model);
    let mut rows = vec![format!("Model {provider}/{model}"), String::from("Default")];
    rows.extend(variants.iter().map(|item| format!("Variant {item}")));
    if variants.is_empty() {
        rows.push(String::from("No variants configured for this model"));
    } else {
        rows.push(String::from(
            "Use /variants <name> to select a variant for this Android session",
        ));
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Variants", rows);
    Ok(())
}

fn console_orgs_panel(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let config = config_value(client);
    let providers = client
        .json("GET", "/v2/provider", None)
        .unwrap_or_else(|_| json!([]));
    let mut rows = Vec::new();
    if let Some(items) = providers.as_array() {
        for provider in items {
            let id = string(provider, "id").unwrap_or_else(|| String::from("provider"));
            let name = string(provider, "name").unwrap_or_else(|| id.clone());
            let configured = config
                .get("provider")
                .and_then(Value::as_object)
                .is_some_and(|items| items.contains_key(&id));
            rows.push(format!(
                "{name}  provider {id}  {}",
                if configured {
                    "configured"
                } else {
                    "available"
                }
            ));
        }
    }
    if rows.is_empty() {
        rows.push(String::from("No provider accounts found"));
    } else {
        rows.insert(
            0,
            String::from("Console org switching uses the connected provider account"),
        );
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Console Orgs", rows);
    Ok(())
}

fn shells_panel(client: &Client, state: &Arc<Mutex<State>>, value: &str) -> Result<(), String> {
    if !value.is_empty() {
        let patch = if value == "default" {
            json!({ "shell": {} })
        } else {
            json!({ "shell": { "program": value } })
        };
        client.json("PATCH", "/global/config", Some(patch))?;
        client.json("POST", "/global/dispose", Some(json!({}))).ok();
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice(if value == "default" {
                String::from("shell reset to system default")
            } else {
                format!("shell set to {value}")
            });
    }
    let config = config_value(client);
    let current = config
        .get("shell")
        .and_then(|item| string(item, "program"))
        .unwrap_or_else(|| String::from("default"));
    let body = client
        .json("GET", "/pty/shells", None)
        .unwrap_or_else(|_| json!([]));
    let mut rows = vec![format!("Current {current}")];
    let mut shells = rows_from_array(&body, &["name", "path", "acceptable"]);
    shells.retain(|row| !row.contains("acceptable false"));
    if shells.is_empty() {
        rows.push(String::from("No acceptable shells found"));
    } else {
        rows.push(String::from("Use /shell <path> or /shell default"));
        rows.extend(shells);
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Shells", rows);
    Ok(())
}

fn themes_panel(state: &Arc<Mutex<State>>, value: &str) -> Result<(), String> {
    let mut rows = DEFAULT_THEME_NAMES
        .iter()
        .map(|item| format!("Theme {item}"))
        .collect::<Vec<_>>();
    if rows.is_empty() {
        rows.push(String::from("No themes found"));
    }
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    if !value.is_empty() {
        if DEFAULT_THEME_NAMES.iter().any(|item| item == &value) {
            locked.notice(format!("theme {value}"));
        } else {
            locked.notice(format!("unknown theme {value}"));
        }
    }
    locked.panel("Themes", rows);
    Ok(())
}

fn plugins_panel(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let config = config_value(client);
    let mut rows = Vec::new();
    if let Some(origins) = config.get("plugin_origins").and_then(Value::as_array) {
        for origin in origins {
            let spec = origin
                .get("spec")
                .and_then(value_display)
                .unwrap_or_else(|| origin.to_string());
            let scope = string(origin, "scope").unwrap_or_else(|| String::from("plugin"));
            let source = string(origin, "source").unwrap_or_default();
            rows.push(format!("{scope} {spec} {source}"));
        }
    }
    if rows.is_empty() {
        if let Some(plugins) = config.get("plugin").and_then(Value::as_array) {
            rows.extend(
                plugins
                    .iter()
                    .filter_map(value_display)
                    .map(|item| format!("plugin {item}")),
            );
        }
    }
    if rows.is_empty() {
        rows.push(String::from("No plugins configured"));
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Plugins", rows);
    Ok(())
}

fn history_mode_panel(state: &Arc<Mutex<State>>) -> Result<(), String> {
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.history_mode = !locked.history_mode;
    let mut rows = vec![if locked.history_mode {
        String::from("History mode on")
    } else {
        String::from("History mode off")
    }];
    if locked.history.is_empty() {
        rows.push(String::from("No prompt history"));
    } else {
        rows.extend(
            locked
                .history
                .iter()
                .rev()
                .take(20)
                .map(|item| format!("Prompt {item}")),
        );
    }
    locked.panel("History", rows);
    Ok(())
}

fn summary_panel(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let body = client
        .json("GET", "/file/status", None)
        .unwrap_or_else(|_| json!([]));
    let rows = rows_from_array(&body, &["path", "file", "status", "additions", "deletions"]);
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.sidebar = true;
    locked.sidebar_mode = SidebarMode::Summary;
    locked.sidebar_rows = if rows.is_empty() {
        vec![String::from("No modified files")]
    } else {
        rows
    };
    let panel_rows = locked.sidebar_rows.clone();
    locked.panel("Sidebar Modified Files", panel_rows);
    Ok(())
}

fn files_panel(client: &Client, state: &Arc<Mutex<State>>, dir: &str) -> Result<(), String> {
    let path = if dir.is_empty() {
        String::new()
    } else {
        encode_query(dir)
    };
    let body = client.json("GET", &format!("/file?path={path}"), None)?;
    let mut rows = rows_from_array(&body, &["path", "name", "type"]);
    if rows.is_empty() {
        rows.push(String::from("No files"));
    } else {
        let file_rows = rows
            .into_iter()
            .map(|row| format!("{row} [open] [attach]"))
            .collect::<Vec<_>>();
        rows = vec![String::from("actions [attach] [open]")];
        rows.extend(file_rows);
    }
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.sidebar = true;
    locked.sidebar_mode = SidebarMode::Files;
    locked.sidebar_rows = rows.clone();
    locked.panel("Open Files", rows);
    Ok(())
}

fn open_file(client: &Client, state: &Arc<Mutex<State>>, file: &str) -> Result<(), String> {
    if file.is_empty() {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("usage: /open <file>");
        return Ok(());
    }
    let session = ensure_session(client, state)?;
    let content = client
        .json(
            "GET",
            &format!("/file/content?path={}", encode_query(file)),
            None,
        )
        .ok()
        .and_then(|body| string(&body, "content"))
        .unwrap_or_default();
    let body = client.json(
        "POST",
        "/editor",
        Some(json!({
            "sessionID": session,
            "file": file,
        })),
    )?;
    let mut editor = editor_from(&body, file);
    if let Ok(snapshot) = editor_snapshot(client, &session, &editor) {
        editor = snapshot;
    } else if !content.is_empty() {
        editor.preview = content
            .lines()
            .take(20)
            .map(|item| item.to_string())
            .collect();
    }
    let rows = editor_rows(&editor);
    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.editor = Some(editor.clone());
    if !locked.open_files.iter().any(|item| item == file) {
        locked.open_files.push(file.to_string());
    }
    locked.panel("Editor", rows);
    Ok(())
}

fn active_editor(state: &Arc<Mutex<State>>) -> Result<Option<(String, Editor)>, String> {
    let locked = state.lock().map_err(|_| "state lock failed")?;
    Ok(locked.session.clone().zip(locked.editor.clone()))
}

fn editor_from(body: &Value, fallback: &str) -> Editor {
    Editor {
        id: string(body, "id").unwrap_or_default(),
        file: string(body, "file").unwrap_or_else(|| fallback.to_string()),
        dirty: boolean(body, "dirty"),
        diff: boolean(body, "diff"),
        diagnostics: diagnostics(body),
        preview: string(body, "content")
            .unwrap_or_default()
            .lines()
            .take(20)
            .map(|item| item.to_string())
            .collect(),
    }
}

fn editor_snapshot(client: &Client, session: &str, editor: &Editor) -> Result<Editor, String> {
    let body = client.json(
        "GET",
        &format!(
            "/editor/{}/snapshot?sessionID={}",
            editor.id,
            encode_query(session)
        ),
        None,
    )?;
    let mut next = editor_from(&body, &editor.file);
    if next.id.is_empty() {
        next.id = editor.id.clone();
    }
    Ok(next)
}

fn save_active_editor(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    if let Some((session, editor)) = active_editor(state)? {
        let body = client.json(
            "POST",
            &format!(
                "/editor/{}/save?sessionID={}",
                editor.id,
                encode_query(&session)
            ),
            Some(json!({})),
        )?;
        let mut next = editor_from(&body, &editor.file);
        if next.id.is_empty() {
            next.id = editor.id;
        }
        let notice = format!("saved {}", next.file);
        let mut rows = editor_rows(&next);
        rows.push(notice.clone());
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.editor = Some(next.clone());
        locked.panel("Editor", rows);
        locked.notice(notice);
    }
    Ok(())
}

fn dismiss_active_diff(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    if let Some((session, editor)) = active_editor(state)? {
        let body = client.json(
            "POST",
            &format!(
                "/editor/{}/diff/dismiss?sessionID={}",
                editor.id,
                encode_query(&session)
            ),
            Some(json!({})),
        )?;
        let mut next = editor_from(&body, &editor.file);
        if next.id.is_empty() {
            next.id = editor.id;
        }
        state.lock().map_err(|_| "state lock failed")?.editor = Some(next.clone());
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .panel("Editor", editor_rows(&next));
    }
    Ok(())
}

fn diagnostics_panel(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    if let Some((session, editor)) = active_editor(state)? {
        let snapshot = editor_snapshot(client, &session, &editor).unwrap_or(editor);
        let rows = if snapshot.diagnostics.is_empty() {
            vec![String::from("No diagnostics")]
        } else {
            snapshot.diagnostics.clone()
        };
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.editor = Some(snapshot);
        locked.panel("Diagnostics", rows);
    }
    Ok(())
}

fn close_editor(client: &Client, state: &Arc<Mutex<State>>, force: bool) -> Result<(), String> {
    if let Some((session, editor)) = active_editor(state)? {
        let latest = editor_snapshot(client, &session, &editor).unwrap_or(editor);
        if latest.dirty && !force {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.editor = Some(latest);
            locked.notice("editor has unsaved changes; use /save or /close-editor!");
            return Ok(());
        }
        client.json(
            "DELETE",
            &format!("/editor/{}?sessionID={}", latest.id, encode_query(&session)),
            None,
        )?;
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.open_files.retain(|item| item != &latest.file);
        locked.editor = None;
        locked.editor_focus = false;
        locked.notice("closed editor");
    }
    Ok(())
}

fn session_action(
    client: &Client,
    state: &Arc<Mutex<State>>,
    action: &str,
    method: &str,
) -> Result<(), String> {
    let session = ensure_session(client, state)?;
    let body = client.json(
        method,
        &format!("/session/{session}/{action}"),
        Some(json!({})),
    )?;
    if let Some(title) = string(&body, "title") {
        state.lock().map_err(|_| "state lock failed")?.title = title;
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .notice(format!("{method} {action}"));
    Ok(())
}

fn revert_session(client: &Client, state: &Arc<Mutex<State>>, message: &str) -> Result<(), String> {
    if message.is_empty() {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("usage: /revert <message-id>");
        return Ok(());
    }
    let session = ensure_session(client, state)?;
    client.json(
        "POST",
        &format!("/session/{session}/revert"),
        Some(json!({ "messageID": message })),
    )?;
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .notice("reverted message");
    Ok(())
}

fn compact_session(client: &Client, state: &Arc<Mutex<State>>) -> Result<(), String> {
    let session = ensure_session(client, state)?;
    let model = state.lock().map_err(|_| "state lock failed")?.model.clone();
    let Some((provider, model)) = model.as_deref().and_then(parse_model) else {
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .notice("select a model before /compact");
        return Ok(());
    };
    client.json(
        "POST",
        &format!("/session/{session}/summarize"),
        Some(json!({ "providerID": provider, "modelID": model })),
    )?;
    Ok(())
}

fn android_runtime_panel(state: &Arc<Mutex<State>>) -> Result<(), String> {
    let clip = command_exists("termux-clipboard-get") && command_exists("termux-clipboard-set");
    let open = command_exists("termux-open");
    let commands = state
        .lock()
        .map_err(|_| "state lock failed")?
        .manifest
        .commands
        .len();
    state.lock().map_err(|_| "state lock failed")?.panel(
        "Android Runtime",
        vec![
            format!("version {}", version()),
            String::from("renderer ratatui/crossterm"),
            format!("tui core {TUI_CORE_VERSION}"),
            format!("shared manifest commands {commands}"),
            String::from("snapshot-backed transcript footer and tabs"),
            format!(
                "termux clipboard {}",
                if clip { "available" } else { "missing" }
            ),
            format!("termux open {}", if open { "available" } else { "missing" }),
            String::from("OpenTUI/Bun FFI is not used on Android"),
        ],
    );
    Ok(())
}

fn keybinds_panel(state: &Arc<Mutex<State>>) -> Result<(), String> {
    let rows = state
        .lock()
        .map_err(|_| "state lock failed")?
        .manifest
        .keybind_rows();
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Keybinds", rows);
    Ok(())
}

fn clipboard_panel(state: &Arc<Mutex<State>>) -> Result<(), String> {
    let get = command_exists("termux-clipboard-get");
    let set = command_exists("termux-clipboard-set");
    let mut rows = vec![
        String::from("Clipboard"),
        format!(
            "termux-clipboard-get {}",
            if get { "available" } else { "missing" }
        ),
        format!(
            "termux-clipboard-set {}",
            if set { "available" } else { "missing" }
        ),
    ];
    if get {
        match command_output_timeout("termux-clipboard-get", &[], Duration::from_millis(500)) {
            Ok(text) if !text.trim().is_empty() => rows.push(format!("current {}", text.trim())),
            Ok(_) => rows.push(String::from("current empty")),
            Err(err) => rows.push(format!("read unavailable: {err}")),
        }
    }
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .panel("Clipboard", rows);
    Ok(())
}

fn sync_permission_focus(state: &mut State) {
    if state.permissions.is_empty() {
        state.permission_index = 0;
        state.permission = None;
        return;
    }
    state.permission_index = state.permission_index.min(state.permissions.len() - 1);
    state.permission = state.permissions.get(state.permission_index).cloned();
}

fn permission_remove(state: &mut State, ids: &[String]) {
    state
        .permissions
        .retain(|item| !ids.iter().any(|id| id == &item.id));
    sync_permission_focus(state);
}

fn permission_focused_mut(state: &mut State) -> Option<&mut Permission> {
    state.permissions.get_mut(state.permission_index)
}

fn permission_reply_targets(state: &State) -> Vec<Permission> {
    let mut out = state
        .permissions
        .iter()
        .filter(|item| item.selected)
        .cloned()
        .collect::<Vec<_>>();
    if out.is_empty() {
        if let Some(permission) = state.permission.clone() {
            out.push(permission);
        }
    }
    out
}

fn permission_move_focus(state: &mut State, step: isize) {
    if state.permissions.is_empty() {
        sync_permission_focus(state);
        return;
    }
    state.permission_index = (state.permission_index as isize + step)
        .rem_euclid(state.permissions.len() as isize) as usize;
    sync_permission_focus(state);
}

fn permission_toggle_focused(state: &mut State) {
    if let Some(permission) = permission_focused_mut(state) {
        permission.selected = !permission.selected;
    }
    sync_permission_focus(state);
}

fn question_single(question: &Question) -> bool {
    question.items.len() == 1 && question.items.first().is_some_and(|item| !item.multiple)
}

fn question_tab_count(question: &Question) -> usize {
    if question_single(question) {
        1
    } else {
        question.items.len() + 1
    }
}

fn question_is_confirm(question: &Question) -> bool {
    !question_single(question) && question.index >= question.items.len()
}

fn question_option_count(item: &QuestionItem) -> usize {
    item.options.len() + if item.custom { 1 } else { 0 }
}

fn question_answer_slot(question: &mut Question, index: usize) -> &mut Vec<String> {
    while question.answers.len() <= index {
        question.answers.push(Vec::new());
    }
    &mut question.answers[index]
}

fn question_custom_value(question: &Question, index: usize) -> String {
    question.custom.get(index).cloned().unwrap_or_default()
}

fn question_set_custom(question: &mut Question, index: usize, value: String) {
    while question.custom.len() <= index {
        question.custom.push(String::new());
    }
    question.custom[index] = value;
}

fn question_select_tab(question: &mut Question, index: usize) {
    let tabs = question_tab_count(question).max(1);
    question.index = index.min(tabs - 1);
    question.selected = 0;
    question.editing = false;
    let custom = question_custom_value(question, question.index);
    question.input.set(custom);
}

fn question_move_tab(question: &mut Question, direction: isize) {
    let tabs = question_tab_count(question);
    if tabs == 0 {
        return;
    }
    let next = (question.index as isize + direction).rem_euclid(tabs as isize) as usize;
    question_select_tab(question, next);
}

fn question_next_tab(question: &mut Question) {
    if question_single(question) {
        return;
    }
    let next = (question.index + 1).min(question_tab_count(question).saturating_sub(1));
    question_select_tab(question, next);
}

fn question_move_selection(question: &mut Question, direction: isize) {
    if question_is_confirm(question) {
        return;
    }
    let Some(item) = question.items.get(question.index) else {
        return;
    };
    let count = question_option_count(item);
    if count == 0 {
        return;
    }
    question.selected =
        (question.selected as isize + direction).rem_euclid(count as isize) as usize;
}

fn question_submit(state: &mut State) -> Option<(String, String, Value)> {
    let done = state.question.take()?;
    let answers = (0..done.items.len())
        .map(|index| done.answers.get(index).cloned().unwrap_or_default())
        .collect::<Vec<_>>();
    Some((
        done.id,
        done.session,
        json!({
            "answers": answers
        }),
    ))
}

fn question_reject(state: &mut State) -> Option<(String, String)> {
    let done = state.question.take()?;
    Some((done.id, done.session))
}

fn question_commit_custom(state: &mut State) -> Option<(String, String, Value)> {
    if state.question.as_ref().is_some_and(question_is_confirm) {
        return question_submit(state);
    }

    let (index, multi, single, text) = {
        let question = state.question.as_ref()?;
        let item = question.items.get(question.index)?;
        (
            question.index,
            item.multiple,
            question_single(question),
            question.input.text.trim().to_string(),
        )
    };

    if text.is_empty() {
        if let Some(question) = state.question.as_mut() {
            let previous = question_custom_value(question, index);
            if !previous.is_empty() {
                question_answer_slot(question, index).retain(|value| value != &previous);
                question_set_custom(question, index, String::new());
            }
            question.editing = false;
        }
        return None;
    }

    let mut submit = false;
    let mut advance = false;
    if let Some(question) = state.question.as_mut() {
        let previous = question_custom_value(question, index);
        question_set_custom(question, index, text.clone());
        let slot = question_answer_slot(question, index);
        if !previous.is_empty() {
            slot.retain(|value| value != &previous);
        }
        if multi {
            if !slot.contains(&text) {
                slot.push(text);
            }
        } else {
            *slot = vec![text];
            submit = single;
            advance = !single;
        }
        question.editing = false;
    }

    if submit {
        return question_submit(state);
    }
    if advance {
        if let Some(question) = state.question.as_mut() {
            question_next_tab(question);
        }
    }
    None
}

fn question_pick_index(state: &mut State, selected: usize) -> Option<(String, String, Value)> {
    if state.question.as_ref().is_some_and(question_is_confirm) {
        return question_submit(state);
    }

    let Some((index, label, option_len, custom, multi, single)) =
        state.question.as_ref().and_then(|question| {
            let item = question.items.get(question.index)?;
            Some((
                question.index,
                item.options.get(selected).map(|(label, _)| label.clone()),
                item.options.len(),
                item.custom,
                item.multiple,
                question_single(question),
            ))
        })
    else {
        return None;
    };

    if let Some(label) = label {
        let mut submit = false;
        let mut advance = false;
        if let Some(question) = state.question.as_mut() {
            question.selected = selected;
            question.editing = false;
            let slot = question_answer_slot(question, index);
            if multi {
                if let Some(existing) = slot.iter().position(|value| value == &label) {
                    slot.remove(existing);
                } else {
                    slot.push(label);
                }
            } else {
                *slot = vec![label];
                submit = single;
                advance = !single;
            }
        }
        if submit {
            return question_submit(state);
        }
        if advance {
            if let Some(question) = state.question.as_mut() {
                question_next_tab(question);
            }
        }
        return None;
    }

    if custom && selected == option_len {
        let has_text = state
            .question
            .as_ref()
            .is_some_and(|question| !question.input.text.trim().is_empty());
        if let Some(question) = state.question.as_mut() {
            question.selected = selected;
            question.editing = true;
        }
        if has_text {
            return question_commit_custom(state);
        }
    }

    None
}

fn question_start_custom_input(state: &mut State, text: &str) -> bool {
    let Some((index, selected, custom_index, custom_value)) =
        state.question.as_ref().and_then(|question| {
            if question_is_confirm(question) {
                return None;
            }
            let item = question.items.get(question.index)?;
            item.custom.then_some((
                question.index,
                question.selected,
                item.options.len(),
                question_custom_value(question, question.index),
            ))
        })
    else {
        return false;
    };

    if let Some(question) = state.question.as_mut() {
        if selected != custom_index {
            question.selected = custom_index;
            question.input.set(custom_value);
        }
        question.editing = true;
        question.input.insert(text);
    }
    true
}

fn spawn_events(
    client: Client,
    state: Arc<Mutex<State>>,
    dirty: Arc<AtomicBool>,
    done: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        while !done.load(Ordering::SeqCst) {
            if let Err(err) = events_once(&client, &state, &dirty, &done) {
                if let Ok(mut locked) = state.lock() {
                    locked.notice(format!("event stream: {err}"));
                }
                dirty.store(true, Ordering::SeqCst);
                thread::sleep(Duration::from_millis(500));
            }
        }
    });
}

fn events_once(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    done: &Arc<AtomicBool>,
) -> Result<(), String> {
    let url = parse_url(&client.url)?;
    let mut stream = connect(&url.host, url.port)?;
    stream
        .set_read_timeout(Some(Duration::from_millis(250)))
        .ok();
    stream
        .write_all(
            format!(
                "GET {}{} HTTP/1.1\r\nHost: {}:{}\r\nAccept: text/event-stream\r\nx-slopcode-daemon-token: {}\r\nConnection: close\r\n\r\n",
                url.base, "/event", url.host, url.port, client.token
            )
            .as_bytes(),
        )
        .map_err(|err| err.to_string())?;
    let mut head = Vec::new();
    let mut body = Vec::new();
    let mut split = false;
    let mut pending = String::new();
    let mut buf = [0u8; 1024];
    while !done.load(Ordering::SeqCst) {
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let mut bytes = &buf[..n];
                if !split {
                    head.extend_from_slice(bytes);
                    if let Some(pos) = head.windows(4).position(|item| item == b"\r\n\r\n") {
                        body.extend_from_slice(&head[pos + 4..]);
                        split = true;
                        bytes = &[];
                    }
                }
                body.extend_from_slice(bytes);
                let text = String::from_utf8_lossy(&body).to_string();
                pending.push_str(&text);
                body.clear();
                while let Some(pos) = pending.find("\n\n") {
                    let block = pending[..pos].to_string();
                    pending = pending[pos + 2..].to_string();
                    if let Some(event) = parse_sse(&block) {
                        let kind = event
                            .get("type")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        apply_event(state, &event);
                        if kind != "server.connected" {
                            let session =
                                state.lock().ok().and_then(|locked| locked.session.clone());
                            let (width, height) = initial_terminal_size();
                            hydrate_surface_frame(client, state, session.as_deref(), width, height)
                                .ok();
                        }
                        dirty.store(true, Ordering::SeqCst);
                    }
                }
            }
            Err(err)
                if err.kind() == io::ErrorKind::WouldBlock
                    || err.kind() == io::ErrorKind::TimedOut =>
            {
                continue;
            }
            Err(err) => return Err(err.to_string()),
        }
    }
    Ok(())
}

fn parse_sse(block: &str) -> Option<Value> {
    let data = block
        .lines()
        .filter_map(|line| line.strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if data.is_empty() {
        return None;
    }
    serde_json::from_str(&data).ok()
}

fn apply_event(state: &Arc<Mutex<State>>, event: &Value) {
    let kind = event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let props = event.get("properties").unwrap_or(event);
    let Ok(mut locked) = state.lock() else {
        return;
    };
    if kind != "server.connected" {
        locked.surface_frame = None;
        locked.surface_hydrated = false;
    }
    match kind {
        "server.connected" => {
            locked.connected = true;
            locked.status = String::from("connected");
        }
        "session.updated" => {
            let info = props.get("info").unwrap_or(props);
            if let Some(id) = string(info, "id") {
                if locked.session.as_deref() == Some(id.as_str()) || locked.session.is_none() {
                    locked.session = Some(id);
                    if let Some(title) = string(info, "title") {
                        locked.title = title;
                    }
                }
            }
        }
        "session.status" => {
            if let Some(status) = props.get("status") {
                locked.status = string(status, "phase")
                    .or_else(|| string(status, "type"))
                    .unwrap_or_else(|| status.to_string());
            }
        }
        "message.updated" => {
            let info = props.get("info").unwrap_or(props);
            if let (Some(id), Some(_session)) = (string(info, "id"), string(info, "sessionID")) {
                let role = string(info, "role").unwrap_or_else(|| String::from("assistant"));
                let current = locked.messages.remove(&id).unwrap_or(Message {
                    id: id.clone(),
                    role: role.clone(),
                    text: String::new(),
                    tools: Vec::new(),
                });
                locked.push_message(Message { role, ..current });
            }
        }
        "message.part.updated" => {
            let part = props.get("part").unwrap_or(props);
            let Some(message_id) = string(part, "messageID") else {
                return;
            };
            let _session = string(part, "sessionID").unwrap_or_default();
            let current = locked
                .messages
                .entry(message_id.clone())
                .or_insert(Message {
                    id: message_id.clone(),
                    role: String::from("assistant"),
                    text: String::new(),
                    tools: Vec::new(),
                });
            match part.get("type").and_then(Value::as_str).unwrap_or_default() {
                "text" => {
                    if let Some(text) = string(part, "text") {
                        let line_count = text.lines().count();
                        if line_count > 12 {
                            let row = if text.trim_start().starts_with("```") {
                                format!("{} more code line(s)", line_count - 12)
                            } else {
                                format!("{} more line(s)", line_count - 12)
                            };
                            if !current.tools.iter().any(|item| item == &row) {
                                current.tools.push(row);
                            }
                        }
                        current.text = text;
                    }
                }
                "tool" => {
                    let tool = string(part, "tool").unwrap_or_else(|| String::from("tool"));
                    let state = part.get("state").unwrap_or(&Value::Null);
                    let status = string(state, "status").unwrap_or_else(|| String::from("pending"));
                    let row = if status == "completed" {
                        format!("tool {tool} {status} [expanded]")
                    } else {
                        format!("tool {tool} {status}")
                    };
                    if !current.tools.iter().any(|item| item == &row) {
                        current.tools.push(row);
                    }
                    if let Some(output) = string(state, "output") {
                        let output_lines = output.lines().collect::<Vec<_>>();
                        for line in output_lines.iter().take(8) {
                            let row = format!("output {line}");
                            if !current.tools.iter().any(|item| item == &row) {
                                current.tools.push(row);
                            }
                        }
                        if output_lines.len() > 8 {
                            let row = format!("{} more line(s)", output_lines.len() - 8);
                            if !current.tools.iter().any(|item| item == &row) {
                                current.tools.push(row);
                            }
                        }
                    }
                    let input_diff = state.get("input").and_then(|input| string(input, "diff"));
                    let metadata_diff = part.get("metadata").and_then(|item| string(item, "diff"));
                    if let Some(diff) = metadata_diff.or(input_diff) {
                        if !current.tools.iter().any(|item| item == "diff preview") {
                            current.tools.push(String::from("diff preview"));
                        }
                        for line in diff
                            .lines()
                            .filter(|line| {
                                line.starts_with("diff --git")
                                    || line.starts_with("--- ")
                                    || line.starts_with("+++ ")
                                    || line.starts_with("@@")
                                    || (line.starts_with('+') && !line.starts_with("+++"))
                                    || (line.starts_with('-') && !line.starts_with("---"))
                            })
                            .take(14)
                        {
                            let row = format!("diff {line}");
                            if !current.tools.iter().any(|item| item == &row) {
                                current.tools.push(row);
                            }
                        }
                    }
                }
                _ => {}
            }
            if !locked.order.iter().any(|item| item == &message_id) {
                locked.order.push(message_id);
            }
        }
        "permission.asked" => {
            if let Some(permission) = permission_from(props) {
                locked.permissions.retain(|item| item.id != permission.id);
                locked.permissions.push(permission.clone());
                locked.permission_index = locked.permissions.len().saturating_sub(1);
                locked.permission = Some(permission);
                locked.notice("permission requested");
            }
        }
        "permission.replied" | "permission.rejected" => {
            let id = string(props, "requestID")
                .or_else(|| string(props, "id"))
                .unwrap_or_default();
            permission_remove(&mut locked, &[id]);
        }
        "question.asked" => {
            if let Some(question) = question_from(props) {
                locked.question = Some(question);
                locked.notice("question requested");
            }
        }
        "question.replied" | "question.rejected" => locked.question = None,
        _ => {}
    }
}

fn apply_chunks(state: &Arc<Mutex<State>>, chunks: &Value) {
    let Some(items) = chunks.as_array() else {
        return;
    };
    for chunk in items {
        let Some(parts) = chunk.get("parts").and_then(Value::as_array) else {
            continue;
        };
        let message_id = string(chunk, "messageID");
        let session_id = string(chunk, "sessionID");
        for part in parts {
            let mut part = part.clone();
            if let Some(map) = part.as_object_mut() {
                if !map.contains_key("messageID") {
                    if let Some(id) = &message_id {
                        map.insert(String::from("messageID"), json!(id));
                    }
                }
                if !map.contains_key("sessionID") {
                    if let Some(id) = &session_id {
                        map.insert(String::from("sessionID"), json!(id));
                    }
                }
            }
            apply_event(
                state,
                &json!({ "type": "message.part.updated", "properties": { "part": part } }),
            );
        }
    }
}

fn permission_from(props: &Value) -> Option<Permission> {
    let metadata = props.get("metadata").unwrap_or(&Value::Null);
    Some(Permission {
        id: string(props, "id")?,
        session: string(props, "sessionID")?,
        kind: string(props, "kind"),
        permission: string(props, "permission").unwrap_or_else(|| String::from("unknown")),
        patterns: props
            .get("patterns")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        item.as_str()
                            .map(str::to_string)
                            .or_else(|| string(item, "pattern"))
                    })
                    .collect()
            })
            .unwrap_or_default(),
        file: string(metadata, "filepath").or_else(|| string(metadata, "file")),
        diff: string(metadata, "diff"),
        source: string(metadata, "source").or_else(|| string(props, "source")),
        request_reason: string(props, "reason"),
        reject_reason: None,
        selected: true,
    })
}

fn question_from(props: &Value) -> Option<Question> {
    let mut items = Vec::new();
    for item in props.get("questions")?.as_array()? {
        let options = item
            .get("options")
            .and_then(Value::as_array)
            .map(|list| {
                list.iter()
                    .filter_map(|option| {
                        Some((
                            string(option, "label")?,
                            string(option, "description").unwrap_or_default(),
                        ))
                    })
                    .collect()
            })
            .unwrap_or_default();
        items.push(QuestionItem {
            header: string(item, "header").unwrap_or_default(),
            question: string(item, "question").unwrap_or_default(),
            options,
            multiple: boolean(item, "multiple"),
            custom: item.get("custom").and_then(Value::as_bool).unwrap_or(true),
        });
    }
    Some(Question {
        id: string(props, "id")?,
        session: string(props, "sessionID")?,
        items,
        index: 0,
        answers: Vec::new(),
        custom: Vec::new(),
        input: Buffer::default(),
        selected: 0,
        editing: false,
    })
}

impl Client {
    fn json(&self, method: &str, path: &str, body: Option<Value>) -> Result<Value, String> {
        let text = self.request(method, path, body.as_ref().map(Value::to_string).as_deref())?;
        if text.trim().is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(&text).map_err(|err| format!("invalid json: {err}: {text}"))
    }

    fn request(&self, method: &str, path: &str, body: Option<&str>) -> Result<String, String> {
        let url = parse_url(&self.url)?;
        let target = format!("{}{}", url.base, path);
        let mut stream = connect(&url.host, url.port)?;
        stream
            .set_read_timeout(Some(Duration::from_secs(60 * 60)))
            .ok();
        let body = body.unwrap_or("");
        let request = format!(
            "{method} {target} HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\nAccept: application/json\r\nContent-Type: application/json\r\nx-slopcode-daemon-token: {}\r\nContent-Length: {}\r\n\r\n{}",
            url.host,
            url.port,
            self.token,
            body.len(),
            body,
        );
        stream
            .write_all(request.as_bytes())
            .map_err(|err| err.to_string())?;
        let bytes = read_response(&mut stream)?;
        let text = String::from_utf8_lossy(&bytes).to_string();
        Ok(text)
    }

    fn editor_message(&self, session: &str, editor: &str, message: &str) -> Result<(), String> {
        let url = parse_url(&self.url)?;
        let path = format!(
            "{}{}",
            url.base,
            format!(
                "/editor/{editor}/connect?sessionID={}",
                encode_query(session)
            )
        );
        let mut stream = connect(&url.host, url.port)?;
        stream
            .write_all(
                format!(
                    "GET {path} HTTP/1.1\r\nHost: {}:{}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nx-slopcode-daemon-token: {}\r\n\r\n",
                    url.host, url.port, self.token
                )
                .as_bytes(),
            )
            .map_err(|err| err.to_string())?;
        let mut raw = [0u8; 512];
        let n = stream.read(&mut raw).map_err(|err| err.to_string())?;
        let head = String::from_utf8_lossy(&raw[..n]);
        if !head.contains("101") {
            return Err(format!("editor websocket upgrade failed: {head}"));
        }
        websocket_text(
            &mut stream,
            &json!({ "type": "input", "keys": message }).to_string(),
        )?;
        Ok(())
    }
}

fn websocket_text(stream: &mut TcpStream, text: &str) -> Result<(), String> {
    let bytes = text.as_bytes();
    let mut frame = vec![0x81];
    if bytes.len() < 126 {
        frame.push(0x80 | bytes.len() as u8);
    } else if bytes.len() <= u16::MAX as usize {
        frame.push(0x80 | 126);
        frame.extend_from_slice(&(bytes.len() as u16).to_be_bytes());
    } else {
        return Err(String::from("websocket frame too large"));
    }
    let mask = [0x12, 0x34, 0x56, 0x78];
    frame.extend_from_slice(&mask);
    for (index, byte) in bytes.iter().enumerate() {
        frame.push(byte ^ mask[index % 4]);
    }
    stream.write_all(&frame).map_err(|err| err.to_string())
}

fn parse_url(input: &str) -> Result<Url, String> {
    let rest = input
        .strip_prefix("http://")
        .ok_or("only http URLs are supported")?;
    let (hostport, path) = rest.split_once('/').unwrap_or((rest, ""));
    let (host, port) = match hostport.rsplit_once(':') {
        Some((host, port)) => (
            host.to_string(),
            port.parse::<u16>().map_err(|_| "invalid port")?,
        ),
        None => (hostport.to_string(), 80),
    };
    let base = if path.is_empty() {
        String::new()
    } else {
        format!("/{path}")
    };
    Ok(Url { host, port, base })
}

fn env_u16(name: &str, fallback: u16) -> u16 {
    env::var(name)
        .ok()
        .and_then(|item| item.parse::<u16>().ok())
        .filter(|item| *item > 0)
        .unwrap_or(fallback)
}

fn initial_terminal_size() -> (u16, u16) {
    crossterm::terminal::size()
        .ok()
        .filter(|(width, height)| *width > 0 && *height > 0)
        .unwrap_or_else(|| (env_u16("COLUMNS", 80), env_u16("LINES", 24)))
}

fn fit_line(text: &str, width: u16) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        if out.chars().count() >= width as usize {
            break;
        }
        out.push(ch);
    }
    while out.chars().count() < width as usize {
        out.push(' ');
    }
    out
}

fn center_line(text: &str, width: u16) -> String {
    let len = text.chars().count() as u16;
    let left = width.saturating_sub(len) / 2;
    fit_line(&format!("{}{}", " ".repeat(left as usize), text), width)
}

fn home_footer_line(
    width: u16,
    directory: &str,
    workspace: Option<&str>,
    mcp: usize,
    mcp_failed: bool,
) -> String {
    let mut left = Vec::new();
    if !directory.is_empty() {
        left.push(directory.to_string());
    }
    if let Some(workspace) = workspace.filter(|item| !item.is_empty()) {
        left.push(format!("workspace {workspace}"));
    }
    if mcp > 0 || mcp_failed {
        left.push(format!("{} MCP{}", mcp, if mcp_failed { "!" } else { "" }));
        left.push(String::from("/status"));
    }
    let left = left.join(" | ");
    let right = version();
    let left_len = left.chars().count() as u16;
    let right_len = right.chars().count() as u16;
    if left.is_empty() {
        return fit_line(&right, width);
    }
    if left_len + 1 + right_len >= width {
        return fit_line(&format!("{left} | {right}"), width);
    }
    let gap = width.saturating_sub(left_len + right_len) as usize;
    fit_line(&format!("{left}{}{}", " ".repeat(gap), right), width)
}

fn initial_surface_frame(
    width: u16,
    height: u16,
    directory: &str,
    workspace: Option<&str>,
    mcp: usize,
    mcp_failed: bool,
) -> Vec<String> {
    let width = width.clamp(20, 240);
    let height = height.clamp(8, 100);
    let mut lines = vec![" ".repeat(width as usize); height as usize];
    let logo = [
        "                                  ",
        "█▀▀ █   █▀█ █▀█  █▀▀ █▀█ █▀▄ █▀▀",
        "▀▀█ █   █ █ █▀▀  █   █ █ █ █ █▀▀",
        "▀▀▀ ▀▀▀ ▀▀▀ ▀    ▀▀▀ ▀▀▀ ▀▀  ▀▀▀",
    ];
    let logo_start = ((height.saturating_sub(8)) / 2).max(1) as usize;
    for (index, line) in logo.iter().enumerate() {
        let row = logo_start + index;
        if row >= lines.len() {
            break;
        }
        lines[row] = center_line(line, width);
    }
    let prompt_width = width.min(75);
    let prompt_left = width.saturating_sub(prompt_width) / 2;
    let prompt_y = (logo_start + logo.len() + 2).min(lines.len().saturating_sub(2));
    let prompt = fit_line("> ", prompt_width);
    lines[prompt_y] = fit_line(
        &format!("{}{}", " ".repeat(prompt_left as usize), prompt),
        width,
    );
    if let Some(last) = lines.last_mut() {
        *last = home_footer_line(width, directory, workspace, mcp, mcp_failed);
    }
    lines
}

fn connect(host: &str, port: u16) -> Result<TcpStream, String> {
    let addrs = (host, port)
        .to_socket_addrs()
        .map_err(|err| format!("resolve {host}:{port}: {err}"))?;
    let mut last = None;
    for addr in addrs {
        match TcpStream::connect_timeout(&addr, Duration::from_secs(5)) {
            Ok(stream) => return Ok(stream),
            Err(err) => last = Some(err),
        }
    }
    Err(format!(
        "connect {host}:{port}: {}",
        last.map(|err| err.to_string())
            .unwrap_or_else(|| String::from("no address"))
    ))
}

fn read_response(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let mut raw = Vec::new();
    stream
        .read_to_end(&mut raw)
        .map_err(|err| err.to_string())?;
    let split = raw
        .windows(4)
        .position(|item| item == b"\r\n\r\n")
        .ok_or("invalid http response")?;
    let head = String::from_utf8_lossy(&raw[..split]);
    let status = head
        .split_whitespace()
        .nth(1)
        .and_then(|item| item.parse::<u16>().ok())
        .ok_or("invalid http status")?;
    let mut bytes = raw[split + 4..].to_vec();
    if head
        .to_ascii_lowercase()
        .contains("transfer-encoding: chunked")
    {
        bytes = chunks(&bytes)?;
    }
    if status < 200 || status >= 300 {
        return Err(format!(
            "http {status}: {}",
            String::from_utf8_lossy(&bytes)
        ));
    }
    Ok(bytes)
}

fn chunks(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut pos = 0;
    loop {
        let end = input[pos..]
            .windows(2)
            .position(|item| item == b"\r\n")
            .ok_or("invalid chunk")?
            + pos;
        let size = std::str::from_utf8(&input[pos..end])
            .map_err(|_| "invalid chunk size")?
            .trim()
            .split(';')
            .next()
            .unwrap_or("0");
        let size = usize::from_str_radix(size, 16).map_err(|_| "invalid chunk size")?;
        pos = end + 2;
        if size == 0 {
            break;
        }
        if pos + size > input.len() {
            return Err(String::from("truncated chunk"));
        }
        out.extend_from_slice(&input[pos..pos + size]);
        pos += size + 2;
        if pos > input.len() {
            return Err(String::from("invalid chunk trailer"));
        }
    }
    Ok(out)
}

fn render(frame: &mut Frame<'_>, state: &State) {
    let area = frame.area();
    if area.width < 20 || area.height < 8 {
        frame.render_widget(Paragraph::new("SlopCode"), area);
        return;
    }
    if let Some(lines) = &state.surface_frame {
        render_surface_frame(frame, area, lines);
        if let Some(panel) = &state.panel {
            let panel_area = centered(
                area,
                area.width.saturating_sub(4).max(20),
                area.height.saturating_sub(6).max(8),
            );
            frame.render_widget(Clear, panel_area);
            render_panel(frame, panel_area, panel);
        }
        if let Some(palette) = &state.command_palette {
            let palette_area = centered(
                area,
                area.width.saturating_sub(4).max(20),
                area.height.saturating_sub(6).max(8),
            );
            frame.render_widget(Clear, palette_area);
            render_command_palette(frame, palette_area, state, palette);
        }
        if !state.input.text.is_empty() || state.shell || !state.attached.is_empty() {
            let height = area.height.min(4);
            let prompt_area = Rect {
                x: area.x,
                y: area.y + area.height.saturating_sub(height),
                width: area.width,
                height,
            };
            frame.render_widget(Clear, prompt_area);
            render_prompt(frame, prompt_area, state);
        }
        if let Some(permission) = &state.permission {
            render_permission(frame, area, state, permission);
        }
        if let Some(question) = &state.question {
            render_question(frame, area, question);
        }
        if state.panel.is_some()
            || state.command_palette.is_some()
            || !state.input.text.is_empty()
            || state.shell
            || !state.attached.is_empty()
            || state.permission.is_some()
            || state.question.is_some()
        {
            return;
        }
        render_idle_notice(frame, area, state);
        return;
    }
    if state.session.is_none()
        && state.messages.is_empty()
        && state.panel.is_none()
        && state.command_palette.is_none()
        && state.permission.is_none()
        && state.question.is_none()
        && state.editor.is_none()
    {
        render_home(frame, area, state);
        return;
    }
    let layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5),
            Constraint::Min(5),
            Constraint::Length(4),
        ])
        .split(area);
    render_header(frame, layout[0], state);
    render_body(frame, layout[1], state);
    render_prompt(frame, layout[2], state);
    if let Some(palette) = &state.command_palette {
        let palette_area = centered(
            area,
            area.width.saturating_sub(4).max(20),
            area.height.saturating_sub(6).max(8),
        );
        frame.render_widget(Clear, palette_area);
        render_command_palette(frame, palette_area, state, palette);
    }
    if let Some(permission) = &state.permission {
        render_permission(frame, area, state, permission);
    }
    if let Some(question) = &state.question {
        render_question(frame, area, question);
    }
}

fn render_surface_frame(frame: &mut Frame<'_>, area: Rect, lines: &[String]) {
    let text = Text::from(
        lines
            .iter()
            .take(area.height as usize)
            .map(|line| Line::from(line.as_str()))
            .collect::<Vec<_>>(),
    );
    frame.render_widget(Paragraph::new(text), area);
}

fn idle_notice(state: &State) -> Option<&str> {
    state
        .notices
        .last()
        .map(String::as_str)
        .filter(|notice| !notice.starts_with("cwd "))
}

fn render_idle_notice(frame: &mut Frame<'_>, area: Rect, state: &State) {
    let Some(notice) = idle_notice(state) else {
        return;
    };
    let line = fit_line(&format!("notice: {notice}"), area.width);
    let notice_area = Rect {
        x: area.x,
        y: area.y + area.height.saturating_sub(3),
        width: area.width,
        height: 1,
    };
    frame.render_widget(Paragraph::new(line), notice_area);
}

fn render_home(frame: &mut Frame<'_>, area: Rect, state: &State) {
    let lines = initial_surface_frame(
        area.width,
        area.height,
        &state.footer_directory,
        state.footer_workspace.as_deref(),
        state.footer_mcp,
        state.footer_mcp_failed,
    );
    render_surface_frame(frame, area, &lines);
    if !state.input.text.is_empty() || state.shell || !state.attached.is_empty() {
        let height = area.height.min(4);
        let prompt_area = Rect {
            x: area.x,
            y: area.y + area.height.saturating_sub(height),
            width: area.width,
            height,
        };
        frame.render_widget(Clear, prompt_area);
        render_prompt(frame, prompt_area, state);
    }
    render_idle_notice(frame, area, state);
}

fn render_header(frame: &mut Frame<'_>, area: Rect, state: &State) {
    let mut right = vec![format!("status {}", state.status)];
    if let Some(model) = &state.model {
        right.push(format!("model {model}"));
    }
    if state.connected {
        right.push(String::from("connected"));
    }
    let text = vec![
        Line::from(vec![
            Span::styled(
                "SlopCode",
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw("  "),
            Span::raw(&state.title),
        ]),
        Line::from(right.join(" | ")),
        Line::from(tab_strip(state)),
    ];
    frame.render_widget(
        Paragraph::new(text).block(Block::default().borders(Borders::ALL)),
        area,
    );
}

fn tab_strip(state: &State) -> String {
    if state.tabs.is_empty() && state.open_files.is_empty() {
        if let Some(session) = &state.session {
            return format!("[*] {}", session);
        }
        return String::from("[home]");
    }
    let mut rows = state
        .tabs
        .iter()
        .map(|tab| {
            let active = state.session.as_deref() == Some(tab.id.as_str());
            let dirty = state
                .editor
                .as_ref()
                .is_some_and(|editor| active && editor.dirty);
            format!(
                "{}{}{}",
                if active { "[*] " } else { "[ ] " },
                tab.title,
                if dirty { " +" } else { "" }
            )
        })
        .collect::<Vec<_>>();
    rows.extend(state.open_files.iter().map(|file| {
        let active = state
            .editor
            .as_ref()
            .is_some_and(|editor| editor.file == *file);
        let dirty = state
            .editor
            .as_ref()
            .is_some_and(|editor| active && editor.dirty);
        format!(
            "{}Editor {}{}",
            if active { "[*] " } else { "[ ] " },
            file,
            if dirty { " +" } else { "" }
        )
    }));
    rows.join("  ")
}

fn render_body(frame: &mut Frame<'_>, area: Rect, state: &State) {
    if state.sidebar {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Min(30), Constraint::Length(area.width.min(34))])
            .split(area);
        render_main_panel(frame, chunks[0], state);
        let title = match state.sidebar_mode {
            SidebarMode::Summary => "Sidebar Modified Files",
            SidebarMode::Files => "Open Files",
        };
        let rows: Vec<ListItem> = state
            .sidebar_rows
            .iter()
            .map(|item| ListItem::new(item.clone()))
            .collect();
        frame.render_widget(
            List::new(rows).block(Block::default().borders(Borders::ALL).title(title)),
            chunks[1],
        );
    } else {
        render_main_panel(frame, area, state);
    }
}

fn render_main_panel(frame: &mut Frame<'_>, area: Rect, state: &State) {
    if let Some(panel) = &state.panel {
        render_panel(frame, area, panel);
        return;
    }
    let mut lines = Vec::new();
    for id in state
        .order
        .iter()
        .rev()
        .take(area.height.saturating_sub(2) as usize)
        .rev()
    {
        if let Some(message) = state.messages.get(id) {
            let role = if message.role == "user" {
                "You"
            } else {
                "Assistant"
            };
            if !message.text.is_empty() {
                for row in clipped_message_lines(role, &message.text) {
                    lines.push(Line::from(row));
                }
            } else {
                lines.push(Line::from(format!("{role}: {}", message.id)));
            }
            render_tool_cards(&mut lines, &message.tools);
        }
    }
    if lines.is_empty() {
        lines.push(Line::from("No transcript yet"));
        lines.push(Line::from("Type a prompt or /help"));
    }
    if let Some(editor) = &state.editor {
        lines.push(Line::from(""));
        lines.push(Line::from(format!(
            "Editor {}{}{}",
            editor.file,
            if editor.dirty { " *" } else { "" },
            if editor.diff { " diff" } else { "" }
        )));
        for row in editor.diagnostics.iter().take(3) {
            lines.push(Line::from(format!("  {row}")));
        }
        for row in editor.preview.iter().take(3) {
            lines.push(Line::from(format!("  {row}")));
        }
    }
    for notice in &state.notices {
        lines.push(Line::from(format!("notice: {notice}")));
    }
    frame.render_widget(
        Paragraph::new(lines)
            .wrap(Wrap { trim: false })
            .block(Block::default().borders(Borders::ALL).title("Session")),
        area,
    );
}

fn clipped_message_lines(role: &str, text: &str) -> Vec<String> {
    let rows = text.lines().collect::<Vec<_>>();
    if rows.len() <= 12 {
        return vec![format!("{role}: {text}")];
    }
    let mut out = Vec::new();
    for (index, row) in rows.iter().take(12).enumerate() {
        if index == 0 {
            out.push(format!("{role}: {row}"));
        } else {
            out.push(format!("  {row}"));
        }
    }
    let kind = if text.trim_start().starts_with("```") {
        "code line"
    } else {
        "line"
    };
    out.push(format!("  {} more {kind}(s)", rows.len() - 12));
    out
}

fn render_tool_cards(lines: &mut Vec<Line<'static>>, tools: &[String]) {
    let mut index = 0;
    while index < tools.len() {
        let row = &tools[index];
        if !row.starts_with("tool ") {
            lines.push(Line::from(format!("  {row}")));
            index += 1;
            continue;
        }

        lines.push(Line::from(format!("  +-- {row}")));
        index += 1;
        while index < tools.len() && !tools[index].starts_with("tool ") {
            let detail = &tools[index];
            if detail == "diff preview" || detail == "more line(s)" {
                lines.push(Line::from(format!("  | {detail}")));
            } else if let Some(output) = detail.strip_prefix("output ") {
                lines.push(Line::from(format!("  | output {output}")));
            } else if let Some(diff) = detail.strip_prefix("diff ") {
                lines.push(Line::from(format!("  | diff {diff}")));
            } else {
                lines.push(Line::from(format!("  | {detail}")));
            }
            index += 1;
        }
        lines.push(Line::from("  +--"));
    }
}

fn render_panel(frame: &mut Frame<'_>, area: Rect, panel: &Panel) {
    let rows: Vec<ListItem> = panel
        .rows
        .iter()
        .map(|item| ListItem::new(item.clone()))
        .collect();
    frame.render_widget(
        List::new(rows).block(Block::default().borders(Borders::ALL)),
        area,
    );
    let title_width = area.width.saturating_sub(2);
    if title_width > 0 && !panel.title.is_empty() {
        let title = fit_line(&panel.title, title_width).trim_end().to_string();
        let width = title
            .chars()
            .count()
            .saturating_add(2)
            .min(title_width as usize) as u16;
        let title_area = Rect {
            x: area.x.saturating_add(1),
            y: area.y,
            width,
            height: 1,
        };
        frame.render_widget(Paragraph::new(title), title_area);
    }
}

fn render_command_palette(
    frame: &mut Frame<'_>,
    area: Rect,
    state: &State,
    palette: &CommandPalette,
) {
    let matches = state.manifest.command_matches(&palette.query);
    let selected = if matches.is_empty() {
        0
    } else {
        palette.selected.min(matches.len() - 1)
    };
    let list_height = area.height.saturating_sub(5) as usize;
    let start = if selected >= list_height {
        selected.saturating_add(1).saturating_sub(list_height)
    } else {
        0
    };
    let mut rows = vec![
        ListItem::new(fit_line(
            &format!("filter: {}", palette.query),
            area.width.saturating_sub(2),
        )),
        ListItem::new("Enter select | Up/Down move | Ctrl-D close"),
    ];
    if matches.is_empty() {
        rows.push(ListItem::new(fit_line(
            &format!("No commands match {}", palette.query),
            area.width.saturating_sub(2),
        )));
    } else {
        for (index, command) in matches.iter().enumerate().skip(start).take(list_height) {
            let marker = if index == selected { "> " } else { "  " };
            rows.push(ListItem::new(fit_line(
                &format!("{marker}{}", state.manifest.command_display(command)),
                area.width.saturating_sub(2),
            )));
        }
    }
    frame.render_widget(
        List::new(rows).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Command Palette"),
        ),
        area,
    );
}

fn render_prompt(frame: &mut Frame<'_>, area: Rect, state: &State) {
    let prefix = if state.shell { "$ " } else { "> " };
    let mut lines = vec![Line::from(format!("{prefix}{}", state.input.rendered()))];
    let mut footer = Vec::new();
    if !state.footer_directory.is_empty() {
        footer.push(state.footer_directory.clone());
    } else if let Some(cwd) = &state.args.cwd {
        footer.push(cwd.clone());
    }
    footer.push(version());
    if let Some(workspace) = &state.footer_workspace {
        footer.push(format!("workspace {workspace}"));
    }
    if state.footer_lsp > 0 {
        footer.push(format!("lsp {}", state.footer_lsp));
    }
    if state.footer_mcp > 0 || state.footer_mcp_failed {
        footer.push(format!(
            "mcp {}{}",
            state.footer_mcp,
            if state.footer_mcp_failed { "!" } else { "" }
        ));
    }
    if state.footer_permissions > 0 {
        footer.push(format!("permissions {}", state.footer_permissions));
    }
    if state.history_mode {
        footer.push(String::from("history"));
    }
    if state.show_timestamps {
        footer.push(String::from("timestamps"));
    }
    if !state.show_thinking {
        footer.push(String::from("thinking hidden"));
    }
    if !state.attached.is_empty() {
        footer.push(format!("{} attached", state.attached.len()));
    }
    if let Some(notice) = state.notices.last() {
        footer.push(format!("notice: {notice}"));
    }
    footer.push(String::from("/help"));
    if !footer.is_empty() {
        lines.push(Line::from(footer.join(" | ")));
    }
    frame.render_widget(
        Paragraph::new(lines).block(Block::default().borders(Borders::ALL).title("Prompt")),
        area,
    );
}

fn render_permission(frame: &mut Frame<'_>, area: Rect, state: &State, permission: &Permission) {
    let selected = state
        .permissions
        .iter()
        .filter(|item| item.selected)
        .count();
    let forecast = state
        .permissions
        .iter()
        .filter(|item| item.kind.as_deref() == Some("forecast"))
        .count();
    let blocking = state.permissions.len().saturating_sub(forecast);
    let mut lines = vec![
        Line::from(Span::styled(
            format!(
                "permission {}/{} {} ({}/{}) selected",
                state.permission_index + 1,
                state.permissions.len().max(1),
                permission.permission,
                selected,
                state.permissions.len().max(1)
            ),
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(format!("session {}", permission.session)),
    ];
    if forecast > 0 {
        let summary = if blocking > 0 {
            format!("{blocking} need approval now - {forecast} planned for build")
        } else {
            format!("{forecast} planned for build")
        };
        lines.push(Line::from(summary));
    }
    if state.permissions.len() > 1 {
        lines.push(Line::from(
            "Use Up/Down or j/k to focus; Space toggles selection.",
        ));
        for (index, item) in state.permissions.iter().enumerate().take(5) {
            let marker = if index == state.permission_index {
                ">"
            } else {
                " "
            };
            let check = if item.selected { "[x]" } else { "[ ]" };
            let summary = item
                .file
                .as_ref()
                .or_else(|| item.patterns.first())
                .cloned()
                .unwrap_or_else(|| item.permission.clone());
            let kind = if item.kind.as_deref() == Some("forecast") {
                " planned"
            } else {
                ""
            };
            let source = item
                .source
                .as_ref()
                .map(|value| format!(" source {value}"))
                .unwrap_or_default();
            lines.push(Line::from(format!(
                "{marker} {check} {} {}{}{}",
                item.permission, summary, kind, source
            )));
        }
    }
    if let Some(source) = &permission.source {
        lines.push(Line::from(format!("source {source}")));
    }
    if let Some(reason) = &permission.request_reason {
        lines.push(Line::from(format!("reason {reason}")));
    }
    if let Some(reason) = &permission.reject_reason {
        lines.push(Line::from(format!("reject reason {reason}")));
    }
    for pattern in &permission.patterns {
        lines.push(Line::from(format!("pattern {pattern}")));
    }
    if let Some(file) = &permission.file {
        lines.push(Line::from(format!("file {file}")));
    }
    if let Some(diff) = &permission.diff {
        for line in diff.lines().take(4) {
            lines.push(Line::from(line.to_string()));
        }
    }
    lines.push(Line::from(
        "o once | a always | r reject | Space select | Esc reject",
    ));
    let rect = centered(area, 78, (lines.len() as u16 + 2).clamp(10, 18));
    frame.render_widget(Clear, rect);
    frame.render_widget(
        Paragraph::new(lines).wrap(Wrap { trim: false }).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Permission required"),
        ),
        rect,
    );
}

fn render_question(frame: &mut Frame<'_>, area: Rect, question: &Question) {
    let mut lines = Vec::new();
    let single = question_single(question);
    if !single {
        let mut tabs = question
            .items
            .iter()
            .enumerate()
            .map(|(index, item)| {
                let answered = question
                    .answers
                    .get(index)
                    .is_some_and(|answers| !answers.is_empty());
                if index == question.index {
                    format!("[{}]", item.header)
                } else if answered {
                    format!("{}*", item.header)
                } else {
                    item.header.clone()
                }
            })
            .collect::<Vec<_>>();
        tabs.push(if question_is_confirm(question) {
            String::from("[Confirm]")
        } else {
            String::from("Confirm")
        });
        lines.push(Line::from(tabs.join("  ")));
        lines.push(Line::from(""));
    }

    if question_is_confirm(question) {
        lines.push(Line::from(Span::styled(
            "Review",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )));
        for (index, item) in question.items.iter().enumerate() {
            let answer = question
                .answers
                .get(index)
                .filter(|answers| !answers.is_empty())
                .map(|answers| answers.join(", "))
                .unwrap_or_else(|| String::from("(not answered)"));
            lines.push(Line::from(format!("{}: {}", item.header, answer)));
        }
        lines.push(Line::from(""));
        lines.push(Line::from("Enter submit | Tab switch | Esc reject"));
    } else if let Some(item) = question.items.get(question.index) {
        lines.push(Line::from(Span::styled(
            item.header.clone(),
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )));
        let suffix = if item.multiple {
            " (select all that apply)"
        } else {
            ""
        };
        lines.push(Line::from(format!("{}{}", item.question, suffix)));
        for (index, (label, description)) in item.options.iter().enumerate() {
            let selected = question.selected == index;
            let picked = question
                .answers
                .get(question.index)
                .is_some_and(|answers| answers.iter().any(|answer| answer == label));
            let marker = if selected { ">" } else { " " };
            let check = if item.multiple {
                if picked {
                    "[x]"
                } else {
                    "[ ]"
                }
            } else if picked {
                "[x]"
            } else {
                "   "
            };
            lines.push(Line::from(format!(
                "{} {} {}. {}  {}",
                marker,
                check,
                index + 1,
                label,
                description
            )));
        }
        if item.custom {
            let index = item.options.len();
            let selected = question.selected == index;
            let custom = question_custom_value(question, question.index);
            let picked = question.answers.get(question.index).is_some_and(|answers| {
                !custom.is_empty() && answers.iter().any(|answer| answer == &custom)
            });
            let marker = if selected { ">" } else { " " };
            let check = if item.multiple {
                if picked {
                    "[x]"
                } else {
                    "[ ]"
                }
            } else if picked {
                "[x]"
            } else {
                "   "
            };
            lines.push(Line::from(format!(
                "{} {} {}. Type your own answer",
                marker,
                check,
                index + 1
            )));
            if selected || question.editing || !custom.is_empty() {
                let value = if question.editing {
                    question.input.rendered()
                } else if custom.is_empty() {
                    String::from("|")
                } else {
                    custom
                };
                lines.push(Line::from(format!("      {value}")));
            }
        }
        lines.push(Line::from(""));
        let enter = if item.multiple { "toggle" } else { "select" };
        let tab = if single { "" } else { " | Tab switch" };
        lines.push(Line::from(format!(
            "Enter {enter} | Up/Down move{tab} | Esc reject"
        )));
    }
    let rect = centered(area, 76, (lines.len() as u16 + 2).clamp(8, 18));
    frame.render_widget(Clear, rect);
    frame.render_widget(
        Paragraph::new(lines).wrap(Wrap { trim: false }).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Question Dialog"),
        ),
        rect,
    );
}

fn centered(area: Rect, width: u16, height: u16) -> Rect {
    let width = width.min(area.width.saturating_sub(2)).max(10);
    let height = height.min(area.height.saturating_sub(2)).max(5);
    Rect {
        x: area.x + area.width.saturating_sub(width) / 2,
        y: area.y + area.height.saturating_sub(height) / 2,
        width,
        height,
    }
}

fn config_value(client: &Client) -> Value {
    client
        .json("GET", "/config", None)
        .or_else(|_| client.json("GET", "/global/config", None))
        .unwrap_or_else(|_| json!({}))
}

fn value_display(value: &Value) -> Option<String> {
    match value {
        Value::String(item) => Some(item.clone()),
        Value::Number(item) => Some(item.to_string()),
        Value::Bool(item) => Some(item.to_string()),
        Value::Null => None,
        Value::Array(_) | Value::Object(_) => Some(value.to_string()),
    }
}

fn field_display(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(value_display)
}

fn rows_from_array(value: &Value, fields: &[&str]) -> Vec<String> {
    let Some(items) = value.as_array() else {
        return if value.is_null() {
            Vec::new()
        } else {
            vec![value.to_string()]
        };
    };
    items
        .iter()
        .map(|item| {
            fields
                .iter()
                .filter_map(|field| {
                    field_display(item, field).map(|value| format!("{field} {value}"))
                })
                .collect::<Vec<_>>()
                .join("  ")
        })
        .filter(|item| !item.is_empty())
        .collect()
}

fn flat_provider_ids(models: &Value) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(items) = models.as_array() {
        for item in items {
            if let Some(id) = string(item, "providerID") {
                out.push(id);
            }
        }
    }
    out.sort();
    out.dedup();
    out
}

fn flat_model_count(models: &Value, provider: &str) -> usize {
    models
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|item| string(item, "providerID").as_deref() == Some(provider))
                .count()
        })
        .unwrap_or(0)
}

fn autocomplete_override(config: &Value, provider: &str) -> String {
    let value = config
        .get("autocomplete")
        .and_then(|item| item.get("provider_model_overrides"))
        .and_then(|item| item.get(provider));
    match value {
        None => String::from("Automatic"),
        Some(Value::Null) => String::from("Selected model"),
        Some(Value::String(model)) => format!("Override {model}"),
        Some(other) => format!("Override {other}"),
    }
}

fn model_variants(providers: &Value, models: &Value, provider: &str, model: &str) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(items) = providers.as_array() {
        for item in items {
            if string(item, "id").as_deref() != Some(provider) {
                continue;
            }
            if let Some(variants) = item
                .get("models")
                .and_then(|items| items.get(model))
                .and_then(|item| item.get("variants"))
                .and_then(Value::as_object)
            {
                out.extend(variants.keys().cloned());
            }
        }
    }
    if out.is_empty() {
        if let Some(items) = models.as_array() {
            for item in items {
                if string(item, "providerID").as_deref() != Some(provider)
                    || string(item, "id").as_deref() != Some(model)
                {
                    continue;
                }
                if let Some(variants) = item.get("variants").and_then(Value::as_object) {
                    out.extend(variants.keys().cloned());
                }
            }
        }
    }
    out.sort();
    out.dedup();
    out
}

fn editor_rows(editor: &Editor) -> Vec<String> {
    let mut rows = vec![
        format!("file {}", editor.file),
        format!("dirty {}", if editor.dirty { "yes" } else { "no" }),
        format!("diff {}", if editor.diff { "open" } else { "dismissed" }),
    ];
    rows.extend(editor.diagnostics.iter().take(8).cloned());
    rows.extend(editor.preview.iter().take(10).cloned());
    if rows.len() == 3 {
        rows.push(String::from("No preview"));
    }
    rows
}

fn diagnostics(body: &Value) -> Vec<String> {
    body.get("diagnostics")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(|item| {
                    let line = item.get("line").and_then(Value::as_i64).unwrap_or(0);
                    let col = item.get("column").and_then(Value::as_i64).unwrap_or(0);
                    let severity =
                        string(item, "severity").unwrap_or_else(|| String::from("diagnostic"));
                    let message = string(item, "message").unwrap_or_else(|| item.to_string());
                    format!("{severity} {line}:{col} {message}")
                })
                .collect()
        })
        .unwrap_or_default()
}

fn string(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

fn string_array(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn boolean(value: &Value, key: &str) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(false)
}

fn usize_field(value: &Value, key: &str) -> usize {
    value
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|item| usize::try_from(item).ok())
        .unwrap_or(0)
}

fn parse_model(input: &str) -> Option<(String, String)> {
    let (provider, model) = input.split_once('/')?;
    if provider.is_empty() || model.is_empty() {
        return None;
    }
    Some((provider.to_string(), model.to_string()))
}

fn encode_query(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn id(prefix: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|item| item.as_millis())
        .unwrap_or(0);
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}_{now:x}{counter:x}")
}

fn command_exists(name: &str) -> bool {
    let path = env::var("PATH").unwrap_or_default();
    for dir in path.split(':') {
        if std::path::Path::new(dir).join(name).exists() {
            return true;
        }
    }
    if let Ok(prefix) = env::var("PREFIX") {
        if std::path::Path::new(&prefix)
            .join("bin")
            .join(name)
            .exists()
        {
            return true;
        }
    }
    false
}

fn command_output_timeout(
    command: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<String, String> {
    let mut child = Command::new(command)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| err.to_string())?;
    let start = Instant::now();
    loop {
        if child.try_wait().map_err(|err| err.to_string())?.is_some() {
            let output = child.wait_with_output().map_err(|err| err.to_string())?;
            if output.status.success() {
                return Ok(String::from_utf8_lossy(&output.stdout).to_string());
            }
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        if start.elapsed() >= timeout {
            child.kill().ok();
            return Err(String::from("timed out"));
        }
        thread::sleep(Duration::from_millis(25));
    }
}

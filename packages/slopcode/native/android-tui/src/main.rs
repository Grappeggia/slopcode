use std::collections::HashMap;
use std::env;
use std::io::{self, IsTerminal, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
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
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap};
use ratatui::{Frame, Terminal, TerminalOptions, Viewport};
use serde_json::{json, Value};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);
const TUI_CORE_VERSION: &str = "rust-ratatui-1";

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

    fn kill_before(&mut self) {
        let end = self.byte(self.cursor);
        self.text.replace_range(0..end, "");
        self.cursor = 0;
    }

    fn kill_after(&mut self) {
        let start = self.byte(self.cursor);
        self.text.replace_range(start.., "");
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
    permission: String,
    patterns: Vec<String>,
    file: Option<String>,
    diff: Option<String>,
    source: Option<String>,
    reason: Option<String>,
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
    input: Buffer,
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

#[derive(Clone)]
struct Tab {
    id: String,
    title: String,
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
    queue: Vec<String>,
    stash: Vec<String>,
    attached: Vec<String>,
    messages: HashMap<String, Message>,
    order: Vec<String>,
    notices: Vec<String>,
    panel: Option<Panel>,
    sidebar: bool,
    sidebar_mode: SidebarMode,
    sidebar_rows: Vec<String>,
    tabs: Vec<Tab>,
    open_files: Vec<String>,
    editor: Option<Editor>,
    editor_focus: bool,
    permissions: Vec<Permission>,
    permission: Option<Permission>,
    permission_index: usize,
    question: Option<Question>,
}

impl State {
    fn new(args: Args) -> Self {
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
            queue: Vec::new(),
            stash: Vec::new(),
            attached: Vec::new(),
            messages: HashMap::new(),
            order: Vec::new(),
            notices: vec![format!("cwd {cwd}")],
            panel: None,
            sidebar: false,
            sidebar_mode: SidebarMode::Summary,
            sidebar_rows: Vec::new(),
            tabs: Vec::new(),
            open_files: Vec::new(),
            editor: None,
            editor_focus: false,
            permissions: Vec::new(),
            permission: None,
            permission_index: 0,
            question: None,
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
        self.panel = Some(Panel {
            title: title.into(),
            rows,
        });
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

fn main() {
    if let Err(err) = run() {
        eprintln!("{err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = parse()?;
    let client = Client {
        url: args.url.clone(),
        token: args.token.clone(),
    };
    let state = Arc::new(Mutex::new(State::new(args.clone())));
    let dirty = Arc::new(AtomicBool::new(true));
    let done = Arc::new(AtomicBool::new(false));

    if args.cont {
        if let Ok(id) = last_session(&client) {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.session = Some(id);
        }
    }
    if let Some(session) = args.session.as_deref() {
        hydrate_session(&client, &state, session).ok();
    }
    if args.fork {
        if let Some(session) = state
            .lock()
            .map_err(|_| "state lock failed")?
            .session
            .clone()
        {
            let forked =
                client.json("POST", &format!("/session/{session}/fork"), Some(json!({})))?;
            if let Some(id) = string(&forked, "id") {
                state.lock().map_err(|_| "state lock failed")?.session = Some(id.clone());
                hydrate_session(&client, &state, &id).ok();
            }
        }
    }
    if let Some(prompt) = args.prompt.clone() {
        ensure_session(&client, &state)?;
        submit_prompt(&client, &state, prompt)?;
    }

    spawn_events(client.clone(), state.clone(), dirty.clone(), done.clone());
    let result = terminal_loop(&client, state, dirty, done);
    result
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
        return Err(String::from("missing --url"));
    }
    if args.token.is_empty() {
        return Err(String::from("missing --token"));
    }
    Ok(args)
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
    Enter,
    Backspace,
    Delete,
    Left,
    Right,
    Home,
    End,
    Up,
    Down,
    Tab,
    CtrlD,
    CtrlC,
    CtrlU,
    CtrlK,
    CtrlW,
    CtrlS,
    CtrlQ,
    F12,
    F13,
}

#[derive(Default)]
struct InputParser {
    paste: bool,
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
            match ch {
                '\u{4}' => out.push(InputAction::CtrlD),
                '\u{3}' => out.push(InputAction::CtrlC),
                '\u{15}' => out.push(InputAction::CtrlU),
                '\u{0b}' => out.push(InputAction::CtrlK),
                '\u{17}' => out.push(InputAction::CtrlW),
                '\u{13}' => out.push(InputAction::CtrlS),
                '\u{11}' => out.push(InputAction::CtrlQ),
                '\r' | '\n' if !self.paste => out.push(InputAction::Enter),
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
    let mut permission_reply = None;
    let mut question_reply = None;
    let mut editor_messages = Vec::new();
    let mut save_editor = false;
    let mut dismiss_diff = false;

    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        if let Some(permission) = locked.permission.clone() {
            if permission.reason.is_none() && !locked.input.text.is_empty() {
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
                    permission_reply = Some((
                        permission.id.clone(),
                        permission.session.clone(),
                        reply,
                        reason,
                    ));
                    locked.permissions.retain(|item| item.id != permission.id);
                    locked.permission_index = locked
                        .permission_index
                        .min(locked.permissions.len().saturating_sub(1));
                    locked.permission = locked.permissions.get(locked.permission_index).cloned();
                }
            }
            if permission_reply.is_none() {
                match (&permission.reason, action) {
                    (Some(_), InputAction::Text(text)) => {
                        if let Some(active) = locked.permission.as_mut() {
                            active
                                .reason
                                .get_or_insert_with(String::new)
                                .push_str(&text);
                        }
                        if let Some(item) = locked
                            .permissions
                            .iter_mut()
                            .find(|item| item.id == permission.id)
                        {
                            item.reason.get_or_insert_with(String::new).push_str(&text);
                        }
                    }
                    (Some(_), InputAction::Backspace) => {
                        if let Some(active) = locked.permission.as_mut() {
                            active.reason.get_or_insert_with(String::new).pop();
                        }
                        if let Some(item) = locked
                            .permissions
                            .iter_mut()
                            .find(|item| item.id == permission.id)
                        {
                            item.reason.get_or_insert_with(String::new).pop();
                        }
                    }
                    (Some(_), InputAction::CtrlU) => {
                        if let Some(active) = locked.permission.as_mut() {
                            active.reason = Some(String::new());
                        }
                        if let Some(item) = locked
                            .permissions
                            .iter_mut()
                            .find(|item| item.id == permission.id)
                        {
                            item.reason = Some(String::new());
                        }
                    }
                    (Some(reason), InputAction::Enter) => {
                        permission_reply = Some((
                            permission.id.clone(),
                            permission.session.clone(),
                            String::from("reject"),
                            Some(reason.clone()),
                        ));
                        locked.permissions.retain(|item| item.id != permission.id);
                        locked.permission_index = locked
                            .permission_index
                            .min(locked.permissions.len().saturating_sub(1));
                        locked.permission =
                            locked.permissions.get(locked.permission_index).cloned();
                    }
                    (_, InputAction::Text(ref text)) if text == "o" || text == "a" => {
                        let reply = if text == "a" { "always" } else { "once" };
                        permission_reply = Some((
                            permission.id.clone(),
                            permission.session.clone(),
                            reply.to_string(),
                            None,
                        ));
                        locked.permissions.retain(|item| item.id != permission.id);
                        locked.permission_index = locked
                            .permission_index
                            .min(locked.permissions.len().saturating_sub(1));
                        locked.permission =
                            locked.permissions.get(locked.permission_index).cloned();
                    }
                    (_, InputAction::Text(ref text)) if text == "r" => {
                        if let Some(active) = locked.permission.as_mut() {
                            active.reason = Some(String::new());
                        }
                        if let Some(item) = locked
                            .permissions
                            .iter_mut()
                            .find(|item| item.id == permission.id)
                        {
                            item.reason = Some(String::new());
                        }
                        locked.notice("enter rejection reason");
                    }
                    (_, InputAction::Text(ref text))
                        if text == "n" && !locked.permissions.is_empty() =>
                    {
                        locked.permission_index =
                            (locked.permission_index + 1) % locked.permissions.len();
                        locked.permission =
                            locked.permissions.get(locked.permission_index).cloned();
                    }
                    (_, InputAction::Text(ref text))
                        if text == "p" && !locked.permissions.is_empty() =>
                    {
                        locked.permission_index =
                            (locked.permission_index + locked.permissions.len() - 1)
                                % locked.permissions.len();
                        locked.permission =
                            locked.permissions.get(locked.permission_index).cloned();
                    }
                    (_, InputAction::CtrlD | InputAction::CtrlC) => {
                        done.store(true, Ordering::SeqCst)
                    }
                    _ => {}
                }
            }
            dirty.store(true, Ordering::SeqCst);
            drop(locked);
            if let Some((id, session, reply, reason)) = permission_reply {
                let mut body = json!({ "reply": reply });
                if let Some(reason) = reason {
                    body["reason"] = json!(reason);
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
            match action {
                InputAction::Enter => {
                    if let Some(body) = question_submit(&mut locked) {
                        question_reply = Some(body);
                    }
                }
                InputAction::Backspace => {
                    if let Some(question) = locked.question.as_mut() {
                        question.input.backspace();
                    }
                }
                InputAction::Left => {
                    if let Some(question) = locked.question.as_mut() {
                        question.input.left();
                    }
                }
                InputAction::Right => {
                    if let Some(question) = locked.question.as_mut() {
                        question.input.right();
                    }
                }
                InputAction::Home => {
                    if let Some(question) = locked.question.as_mut() {
                        question.input.home();
                    }
                }
                InputAction::End => {
                    if let Some(question) = locked.question.as_mut() {
                        question.input.end();
                    }
                }
                InputAction::Text(text) => {
                    if let Some(question) = locked.question.as_mut() {
                        question.input.insert(&text);
                    }
                }
                InputAction::CtrlD | InputAction::CtrlC => done.store(true, Ordering::SeqCst),
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

        match action {
            InputAction::CtrlD => done.store(true, Ordering::SeqCst),
            InputAction::CtrlC => {
                if locked.input.text.is_empty() {
                    done.store(true, Ordering::SeqCst);
                } else {
                    locked.input = Buffer::default();
                }
            }
            InputAction::CtrlU => locked.input.kill_before(),
            InputAction::CtrlK => locked.input.kill_after(),
            InputAction::CtrlW => locked.input.delete_word_before(),
            InputAction::Backspace => locked.input.backspace(),
            InputAction::Delete => locked.input.delete(),
            InputAction::Left => locked.input.left(),
            InputAction::Right => locked.input.right(),
            InputAction::Home => locked.input.home(),
            InputAction::End => locked.input.end(),
            InputAction::Up => locked.history_prev(),
            InputAction::Down => locked.history_next(),
            InputAction::Tab => complete_command(&mut locked),
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
            InputAction::Text(text) => locked.input.insert(&text),
        }
    }

    dirty.store(true, Ordering::SeqCst);
    if let Some(text) = submit {
        let trimmed = text.trim().to_string();
        if trimmed == "/exit" || trimmed == "/quit" {
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
    let matches: Vec<&str> = COMMANDS
        .iter()
        .copied()
        .filter(|cmd| cmd.starts_with(text.trim()))
        .collect();
    if matches.len() == 1 {
        state.input.set(matches[0].to_string());
        state.input.insert(" ");
    } else if !matches.is_empty() {
        state.panel(
            "Command Matches",
            matches.into_iter().map(|item| item.to_string()).collect(),
        );
    }
}

const COMMANDS: &[&str] = &[
    "/help",
    "/commands",
    "/new",
    "/sessions",
    "/tabs",
    "/session",
    "/children",
    "/messages",
    "/timeline",
    "/status",
    "/close",
    "/model",
    "/models",
    "/providers",
    "/agents",
    "/summary",
    "/files",
    "/open",
    "/attach",
    "/edit",
    "/save",
    "/diagnostics",
    "/diff",
    "/close-editor",
    "/close-editor!",
    "/share",
    "/unshare",
    "/pause",
    "/resume",
    "/interrupt",
    "/revert",
    "/unrevert",
    "/compact",
    "/fork",
    "/queue",
    "/stash",
    "/list",
    "/pop",
    "/shell",
    "/doctor",
    "/themes",
    "/keybinds",
    "/clipboard",
    "/title",
    "/suspend",
    "/plugins",
];

fn command_rows(query: &str) -> Vec<String> {
    let sections = [
        (
            "Session",
            "/sessions /children /messages /timeline /new /session <id> /tabs /close /fork",
        ),
        (
            "Agent",
            "/models [query] /model provider/model /providers /agents",
        ),
        (
            "Workspace",
            "/summary /files [dir] /attach <file> /open <file> /edit /save /diagnostics /close-editor[!] /diff [dismiss] /status /queue /stash /list /pop /share /unshare /compact /pause /resume /interrupt /revert <message-id> /unrevert",
        ),
        (
            "System",
            "/doctor /shell /themes /keybinds /clipboard /title <title> /suspend /plugins /help /exit",
        ),
    ];
    let needle = query.trim().to_lowercase();
    if !needle.is_empty() {
        let rows = COMMANDS
            .iter()
            .filter(|command| command.to_lowercase().contains(&needle))
            .map(|command| format!("{command}  run directly or complete with Tab"))
            .collect::<Vec<_>>();
        if rows.is_empty() {
            return vec![format!("No commands match {query}")];
        }
        return rows;
    }
    sections
        .iter()
        .map(|(section, text)| format!("{section}: {text}"))
        .collect()
}

fn command(client: &Client, state: &Arc<Mutex<State>>, input: &str) -> Result<(), String> {
    let (name, value) = input
        .trim_start_matches('/')
        .split_once(' ')
        .map(|(a, b)| (a.trim(), b.trim()))
        .unwrap_or_else(|| (input.trim_start_matches('/'), ""));
    match name {
        "help" | "commands" => {
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Command Palette", command_rows(value));
        }
        "new" => {
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
        "session" => {
            if value.is_empty() {
                sessions_panel(client, state)?;
            } else {
                state.lock().map_err(|_| "state lock failed")?.session = Some(value.to_string());
                hydrate_session(client, state, value).ok();
            }
        }
        "sessions" => sessions_panel(client, state)?,
        "tabs" => tabs_panel(state)?,
        "children" => {
            let session = ensure_session(client, state)?;
            let body = client.json("GET", &format!("/session/{session}/children"), None)?;
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Child Sessions", rows_from_array(&body, &["id", "title"]));
        }
        "messages" | "timeline" => {
            let session = ensure_session(client, state)?;
            hydrate_messages(client, state, &session)?;
            state.lock().map_err(|_| "state lock failed")?.panel = None;
        }
        "status" => {
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
        "model" => {
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
        "models" => models_panel(client, state, value)?,
        "providers" | "connect" => {
            let body = client.json("GET", "/v2/provider", None)?;
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Providers", rows_from_array(&body, &["id", "name", "type"]));
        }
        "agents" | "agent" => {
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
        "summary" => summary_panel(client, state)?,
        "files" => files_panel(client, state, value)?,
        "open" => open_file(client, state, value)?,
        "attach" => {
            if !value.is_empty() {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .attached
                    .push(value.to_string());
            }
        }
        "edit" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if locked.editor.is_some() {
                locked.editor_focus = true;
                locked.notice("input focus");
            } else {
                locked.notice("no active editor; use /open <file>");
            }
        }
        "save" => save_active_editor(client, state)?,
        "diagnostics" => diagnostics_panel(client, state)?,
        "diff" => {
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
        "close-editor" | "close-editor!" => close_editor(client, state, name.ends_with('!'))?,
        "share" => session_action(client, state, "share", "POST")?,
        "unshare" => session_action(client, state, "share", "DELETE")?,
        "pause" => session_action(client, state, "pause", "POST")?,
        "resume" => session_action(client, state, "resume", "POST")?,
        "interrupt" | "abort" => session_action(client, state, "abort", "POST")?,
        "revert" => revert_session(client, state, value)?,
        "unrevert" => session_action(client, state, "unrevert", "POST")?,
        "compact" => compact_session(client, state)?,
        "fork" => {
            let session = ensure_session(client, state)?;
            let body = client.json("POST", &format!("/session/{session}/fork"), Some(json!({})))?;
            if let Some(id) = string(&body, "id") {
                state.lock().map_err(|_| "state lock failed")?.session = Some(id.clone());
                hydrate_session(client, state, &id).ok();
            }
        }
        "close" => close_tab(state)?,
        "queue" => {
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
        "stash" | "list" => {
            let rows = {
                let locked = state.lock().map_err(|_| "state lock failed")?;
                if locked.stash.is_empty() {
                    vec![String::from("stash empty")]
                } else {
                    locked.stash.clone()
                }
            };
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Prompt Stash", rows);
        }
        "pop" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if let Some(text) = locked.stash.pop() {
                locked.input.set(text);
            }
        }
        "shell" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.shell = !locked.shell;
            let notice = if locked.shell {
                "shell mode on"
            } else {
                "shell mode off"
            };
            locked.notice(notice);
        }
        "doctor" => android_runtime_panel(state)?,
        "themes" => state.lock().map_err(|_| "state lock failed")?.panel(
            "Themes",
            vec![
                String::from("Terminal colors follow the active Termux theme."),
                String::from("Rust TUI uses ratatui styles for Linux parity."),
            ],
        ),
        "keybinds" => keybinds_panel(state)?,
        "clipboard" => clipboard_panel(state)?,
        "title" => {
            if !value.is_empty() {
                let session = ensure_session(client, state)?;
                client.json(
                    "PATCH",
                    &format!("/session/{session}"),
                    Some(json!({ "title": value })),
                )?;
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.title = value.to_string();
                locked.notice(format!("title {value}"));
            }
        }
        "suspend" => state.lock().map_err(|_| "state lock failed")?.panel(
            "Suspend",
            vec![
                String::from("Ctrl-Z is handled by Termux and the parent shell."),
                String::from("Use Android app switching to background SlopCode."),
            ],
        ),
        "plugins" | "mcps" => state.lock().map_err(|_| "state lock failed")?.panel(
            "Plugins",
            vec![
                String::from("Plugins discovery remains daemon-backed."),
                String::from("Rust Termux TUI renders plugin status without OpenTUI."),
            ],
        ),
        _ => {
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .notice(format!("unknown command /{name}"));
        }
    }
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
    if let Some(session) = current.as_deref() {
        let title = locked.title.clone();
        locked.sync_tab(session, &title);
    }
    let rows = if locked.tabs.is_empty() {
        vec![String::from("No open tabs")]
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
        state.lock().map_err(|_| "state lock failed")?.editor = Some(next.clone());
        state
            .lock()
            .map_err(|_| "state lock failed")?
            .panel("Editor", editor_rows(&next));
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
    state.lock().map_err(|_| "state lock failed")?.panel(
        "Android Runtime",
        vec![
            format!("version {}", version()),
            String::from("renderer ratatui/crossterm"),
            format!("tui core {TUI_CORE_VERSION}"),
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
    state.lock().map_err(|_| "state lock failed")?.panel(
        "Keybinds",
        vec![
            String::from("Enter submit"),
            String::from("Ctrl-D exit or leave dialog"),
            String::from("Ctrl-U clear before cursor"),
            String::from("Ctrl-K clear after cursor"),
            String::from("Ctrl-W delete previous word"),
            String::from("Tab complete slash commands"),
            String::from("Up/Down prompt history"),
            String::from("F12 stash prompt, F13 restore prompt"),
        ],
    );
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

fn question_submit(state: &mut State) -> Option<(String, String, Value)> {
    let question = state.question.as_mut()?;
    let item = question.items.get(question.index)?;
    let answer = parse_answer(&question.input.text, item);
    if answer.is_empty() {
        state.notice("answer with option number, label, or text");
        return None;
    }
    question.answers.push(answer);
    question.input.clear();
    if question.index + 1 < question.items.len() {
        question.index += 1;
        return None;
    }
    let done = state.question.take()?;
    Some((
        done.id,
        done.session,
        json!({
            "answers": done.answers
        }),
    ))
}

fn parse_answer(input: &str, question: &QuestionItem) -> Vec<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let parts: Vec<&str> = if question.multiple {
        trimmed
            .split(',')
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .collect()
    } else {
        vec![trimmed]
    };
    let mut out = Vec::new();
    for part in parts {
        if let Ok(index) = part.parse::<usize>() {
            if let Some((label, _)) = question.options.get(index.saturating_sub(1)) {
                out.push(label.clone());
                continue;
            }
        }
        if let Some((label, _)) = question
            .options
            .iter()
            .find(|(label, _)| label.eq_ignore_ascii_case(part))
        {
            out.push(label.clone());
            continue;
        }
        if question.custom {
            out.push(part.to_string());
        }
    }
    if question.multiple {
        out.sort();
        out.dedup();
    }
    out
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
                        apply_event(state, &event);
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
        "permission.replied" => {
            let id = string(props, "requestID")
                .or_else(|| string(props, "id"))
                .unwrap_or_default();
            locked.permissions.retain(|item| item.id != id);
            locked.permission_index = locked
                .permission_index
                .min(locked.permissions.len().saturating_sub(1));
            locked.permission = locked.permissions.get(locked.permission_index).cloned();
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
        reason: string(props, "reason"),
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
        input: Buffer::default(),
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
    if state.session.is_none()
        && state.messages.is_empty()
        && state.panel.is_none()
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
            Constraint::Length(3),
            Constraint::Min(5),
            Constraint::Length(4),
        ])
        .split(area);
    render_header(frame, layout[0], state);
    render_body(frame, layout[1], state);
    render_prompt(frame, layout[2], state);
    if let Some(permission) = &state.permission {
        render_permission(frame, area, state, permission);
    }
    if let Some(question) = &state.question {
        render_question(frame, area, question);
    }
}

fn render_home(frame: &mut Frame<'_>, area: Rect, state: &State) {
    let layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(8),
            Constraint::Length(4),
        ])
        .split(area);
    let header = Paragraph::new(Text::from(vec![
        Line::from(Span::styled(
            "SlopCode",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from("Rust-native Termux TUI"),
    ]))
    .block(Block::default().borders(Borders::ALL).title("Home"))
    .alignment(Alignment::Center);
    frame.render_widget(header, layout[0]);
    let examples = List::new(vec![
        ListItem::new("Fix a TODO in the codebase"),
        ListItem::new("Explain the current directory"),
        ListItem::new("Run tests and summarize failures"),
        ListItem::new("/status"),
        ListItem::new("/help"),
    ])
    .block(Block::default().borders(Borders::ALL).title("Start"));
    frame.render_widget(examples, layout[1]);
    render_prompt(frame, layout[2], state);
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
    ];
    frame.render_widget(
        Paragraph::new(text).block(Block::default().borders(Borders::ALL)),
        area,
    );
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
        let rows: Vec<ListItem> = panel
            .rows
            .iter()
            .map(|item| ListItem::new(item.clone()))
            .collect();
        frame.render_widget(
            List::new(rows).block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(panel.title.as_str()),
            ),
            area,
        );
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
                lines.push(Line::from(format!("{role}: {}", message.text)));
            } else {
                lines.push(Line::from(format!("{role}: {}", message.id)));
            }
            for tool in &message.tools {
                lines.push(Line::from(format!("  {tool}")));
            }
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

fn render_prompt(frame: &mut Frame<'_>, area: Rect, state: &State) {
    let prefix = if state.shell { "$ " } else { "> " };
    let mut lines = vec![Line::from(format!("{prefix}{}", state.input.rendered()))];
    let mut footer = Vec::new();
    if let Some(session) = &state.session {
        footer.push(session.clone());
    }
    if let Some(cwd) = &state.args.cwd {
        footer.push(cwd.clone());
    }
    if !state.attached.is_empty() {
        footer.push(format!("{} attached", state.attached.len()));
    }
    if let Some(notice) = state.notices.last() {
        footer.push(format!("notice: {notice}"));
    }
    if !footer.is_empty() {
        lines.push(Line::from(footer.join(" | ")));
    }
    frame.render_widget(
        Paragraph::new(lines).block(Block::default().borders(Borders::ALL).title("Prompt")),
        area,
    );
}

fn render_permission(frame: &mut Frame<'_>, area: Rect, state: &State, permission: &Permission) {
    let rect = centered(area, 76, 13);
    frame.render_widget(Clear, rect);
    let mut lines = vec![
        Line::from(Span::styled(
            format!(
                "permission {}/{} {}",
                state.permission_index + 1,
                state.permissions.len().max(1),
                permission.permission
            ),
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(format!("session {}", permission.session)),
    ];
    if let Some(source) = &permission.source {
        lines.push(Line::from(format!("source {source}")));
    }
    if let Some(reason) = &permission.reason {
        lines.push(Line::from(format!("reason {reason}")));
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
    lines.push(Line::from("o once | a always | r reject | n/p switch"));
    frame.render_widget(
        Paragraph::new(lines)
            .wrap(Wrap { trim: false })
            .block(Block::default().borders(Borders::ALL).title("Permission")),
        rect,
    );
}

fn render_question(frame: &mut Frame<'_>, area: Rect, question: &Question) {
    let rect = centered(area, 72, 12);
    frame.render_widget(Clear, rect);
    let item = question.items.get(question.index);
    let mut lines = Vec::new();
    if let Some(item) = item {
        lines.push(Line::from(Span::styled(
            item.header.clone(),
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )));
        lines.push(Line::from(item.question.clone()));
        for (index, (label, description)) in item.options.iter().enumerate() {
            lines.push(Line::from(format!(
                "{}. {}  {}",
                index + 1,
                label,
                description
            )));
        }
        lines.push(Line::from(format!("answer {}", question.input.rendered())));
    }
    frame.render_widget(
        Paragraph::new(lines)
            .wrap(Wrap { trim: false })
            .block(Block::default().borders(Borders::ALL).title("Question")),
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
                .filter_map(|field| string(item, field).map(|value| format!("{field} {value}")))
                .collect::<Vec<_>>()
                .join("  ")
        })
        .filter(|item| !item.is_empty())
        .collect()
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

fn boolean(value: &Value, key: &str) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(false)
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

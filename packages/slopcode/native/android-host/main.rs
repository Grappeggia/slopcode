use std::env;
use std::io::{self, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Default)]
struct Args {
    url: String,
    token: String,
    session: Option<String>,
    cont: bool,
    fork: bool,
    model: Option<String>,
    agent: Option<String>,
    prompt: Option<String>,
}

#[derive(Clone)]
struct Message {
    id: String,
    session: String,
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
    reject: Option<String>,
}

#[derive(Clone)]
struct Tab {
    id: String,
    title: String,
}

struct Panel {
    title: String,
    rows: Vec<String>,
}

#[derive(Clone)]
struct Editor {
    id: String,
    file: String,
    dirty: bool,
    diff: bool,
    diagnostics: Vec<String>,
    preview: Vec<String>,
}

struct EditorInputAction {
    session: String,
    editor: Editor,
    messages: Vec<String>,
    save: bool,
    dismiss: bool,
    blur: bool,
}

#[derive(Default)]
struct EditorKeys {
    messages: Vec<String>,
    save: bool,
    dismiss: bool,
    blur: bool,
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

    fn word_left(&mut self) {
        while self.cursor > 0
            && self
                .text
                .chars()
                .nth(self.cursor - 1)
                .is_some_and(char::is_whitespace)
        {
            self.left();
        }
        while self.cursor > 0
            && self
                .text
                .chars()
                .nth(self.cursor - 1)
                .is_some_and(|ch| !ch.is_whitespace())
        {
            self.left();
        }
    }

    fn word_right(&mut self) {
        while self.cursor < self.len()
            && self
                .text
                .chars()
                .nth(self.cursor)
                .is_some_and(|ch| !ch.is_whitespace())
        {
            self.right();
        }
        while self.cursor < self.len()
            && self
                .text
                .chars()
                .nth(self.cursor)
                .is_some_and(char::is_whitespace)
        {
            self.right();
        }
    }

    fn rendered(&self) -> String {
        let index = self.byte(self.cursor);
        format!("{}|{}", &self.text[..index], &self.text[index..])
    }
}

struct QuestionItem {
    header: String,
    question: String,
    options: Vec<String>,
    multiple: bool,
    custom: bool,
}

struct Question {
    id: String,
    session: String,
    items: Vec<QuestionItem>,
    index: usize,
    answers: Vec<Vec<String>>,
    input: Buffer,
}

struct State {
    session: Option<String>,
    title: String,
    status: String,
    cwd: String,
    input: Buffer,
    history: Vec<String>,
    history_index: Option<usize>,
    history_draft: String,
    paste: Option<String>,
    model: Option<String>,
    agent: Option<String>,
    shell: bool,
    queue: usize,
    stash: Vec<String>,
    messages: Vec<Message>,
    notices: Vec<String>,
    permission: Option<Permission>,
    question: Option<Question>,
    tabs: Vec<Tab>,
    panel: Option<Panel>,
    sidebar: Vec<String>,
    sidebar_visible: bool,
    sidebar_mode: String,
    sidebar_files: Vec<String>,
    open_files: Vec<String>,
    attached_files: Vec<String>,
    active_file: Option<String>,
    editor: Option<Editor>,
    editor_focus: bool,
    runtime: String,
    runtime_path: String,
    version: String,
    permissions: Vec<Permission>,
    permission_index: usize,
}

impl State {
    fn new(args: &Args) -> Self {
        let home = args.session.is_none() && !args.cont && args.prompt.is_none();
        Self {
            session: args.session.clone(),
            title: String::from("new session"),
            status: if home {
                String::from("home")
            } else {
                String::from("starting")
            },
            cwd: env::current_dir()
                .ok()
                .map(|item| item.display().to_string())
                .unwrap_or_else(|| String::from("unknown")),
            input: Buffer::default(),
            history: Vec::new(),
            history_index: None,
            history_draft: String::new(),
            paste: None,
            model: args.model.clone(),
            agent: args.agent.clone(),
            shell: false,
            queue: 0,
            stash: Vec::new(),
            messages: Vec::new(),
            notices: Vec::new(),
            permission: None,
            question: None,
            tabs: Vec::new(),
            panel: None,
            sidebar: Vec::new(),
            sidebar_visible: false,
            sidebar_mode: String::from("summary"),
            sidebar_files: Vec::new(),
            open_files: Vec::new(),
            attached_files: Vec::new(),
            active_file: None,
            editor: None,
            editor_focus: false,
            runtime: String::from("rust-tui"),
            runtime_path: env::current_exe()
                .ok()
                .map(|item| item.display().to_string())
                .unwrap_or_else(|| String::from("unknown")),
            version: version(),
            permissions: Vec::new(),
            permission_index: 0,
        }
    }

    fn notice(&mut self, text: impl Into<String>) {
        let text = text.into();
        if self.notices.last().is_some_and(|item| item == &text) {
            return;
        }
        self.notices.push(text);
        if self.notices.len() > 8 {
            self.notices.remove(0);
        }
    }

    fn panel(&mut self, title: impl Into<String>, rows: Vec<String>) {
        let title = title.into();
        self.notice(title.clone());
        self.panel = Some(Panel {
            title,
            rows,
        });
    }

    fn close_panel(&mut self) {
        self.panel = None;
    }

    fn sync_tab(&mut self, id: &str, title: &str) {
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

    fn message(&mut self, id: &str, session: &str, role: &str) -> &mut Message {
        if let Some(index) = self.messages.iter().position(|item| item.id == id) {
            self.messages[index].session = session.to_string();
            self.messages[index].role = role.to_string();
            return &mut self.messages[index];
        }
        self.messages.push(Message {
            id: id.to_string(),
            session: session.to_string(),
            role: role.to_string(),
            text: String::new(),
            tools: Vec::new(),
        });
        self.messages.last_mut().unwrap()
    }

    fn history_push(&mut self, text: &str) {
        if text.trim().is_empty() {
            return;
        }
        if self.history.last().is_some_and(|item| item == text) {
            self.history_index = None;
            self.history_draft.clear();
            return;
        }
        self.history.push(text.to_string());
        if self.history.len() > 50 {
            self.history.remove(0);
        }
        self.history_index = None;
        self.history_draft.clear();
    }

    fn history_move(&mut self, step: i32) {
        if self.history.is_empty() {
            return;
        }
        if self.history_index.is_none() {
            self.history_draft = self.input.text.clone();
        }
        let base = self.history_index.unwrap_or(self.history.len());
        if step < 0 {
            let next = base.saturating_sub(1);
            self.history_index = Some(next);
            self.input.set(self.history[next].clone());
            return;
        }
        if base + 1 >= self.history.len() {
            self.history_index = None;
            self.input.set(std::mem::take(&mut self.history_draft));
            return;
        }
        let next = base + 1;
        self.history_index = Some(next);
        self.input.set(self.history[next].clone());
    }
}

struct Client {
    url: String,
    token: String,
}

struct Url {
    host: String,
    port: u16,
    base: String,
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
    if raw.iter().any(|item| item == "--json") {
        println!(
            "{{\"version\":{},\"platform\":{},\"arch\":{},\"termux\":{},\"mode\":\"rust\",\"strategy\":\"rust\",\"renderer\":\"rust-native\",\"targetRenderer\":\"ratatui/crossterm\",\"available\":true,\"reason\":\"rust Android TUI runtime\",\"root\":{},\"sidecar\":{},\"sidecarExists\":{},\"bun\":null,\"ffiBlocked\":false,\"clipboardBackend\":\"termux-api-command\",\"mouse\":false,\"pluginProtocol\":\"declarative-planned\"}}",
            json(&version()),
            json(env::consts::OS),
            json(env::consts::ARCH),
            env::var("TERMUX_VERSION").is_ok() || env::var("PREFIX").map(|item| item.contains("/com.termux/")).unwrap_or(false),
            json(&root),
            json(&sidecar),
            exists,
        );
        return Ok(());
    }
    println!("Android runtime: rust");
    println!("version: {}", version());
    println!("renderer: rust-native");
    println!("target renderer: ratatui/crossterm");
    println!("sidecar: {sidecar}");
    println!("sidecar exists: {exists}");
    println!("bun: not bundled");
    Ok(())
}

fn main() {
    if let Err(err) = run() {
        eprintln!("{err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = parse()?;
    if args.url.is_empty() {
        return Err(String::from("missing --url"));
    }
    if args.token.is_empty() {
        return Err(String::from("missing --token"));
    }

    let client = Client {
        url: args.url.clone(),
        token: args.token.clone(),
    };
    let state = Arc::new(Mutex::new(State::new(&args)));
    let dirty = Arc::new(AtomicBool::new(true));
    let done = Arc::new(AtomicBool::new(false));

    let mut term = Terminal::start()?;
    {
        let locked = state.lock().map_err(|_| "state lock failed")?;
        draw(&locked, term.size());
    }
    initialize(&client, &args, &state, &dirty)?;
    spawn_events(client.clone(), state.clone(), dirty.clone(), done.clone());

    if let Some(prompt) = args.prompt.clone() {
        submit_prompt(&client, &state, &dirty, &prompt).ok();
    }

    loop {
        if dirty.swap(false, Ordering::SeqCst) {
            let locked = state.lock().map_err(|_| "state lock failed")?;
            draw(&locked, term.size());
        }
        let mut buf = [0u8; 4096];
        let count = io::stdin().read(&mut buf).unwrap_or(0);
        if count > 0 && input(&client, &state, &dirty, &done, &buf[..count])? {
            break;
        }
        if done.load(Ordering::SeqCst) {
            break;
        }
        thread::sleep(Duration::from_millis(20));
    }

    done.store(true, Ordering::SeqCst);
    term.stop();
    Ok(())
}

impl Clone for Client {
    fn clone(&self) -> Self {
        Self {
            url: self.url.clone(),
            token: self.token.clone(),
        }
    }
}

fn parse() -> Result<Args, String> {
    let mut args = Args::default();
    let mut iter = env::args().skip(1);
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--url" => args.url = iter.next().ok_or("missing --url value")?,
            "--token" => args.token = iter.next().ok_or("missing --token value")?,
            "--session" => args.session = iter.next(),
            "--continue" => args.cont = true,
            "--fork" => args.fork = true,
            "--model" => args.model = iter.next(),
            "--agent" => args.agent = iter.next(),
            "--prompt" => args.prompt = iter.next(),
            "--cwd" | "--view-id" => {
                iter.next();
            }
            "--self-test" => {
                println!("slopcode-android-host ok");
                std::process::exit(0);
            }
            "--version" | "-V" => {
                println!("{}", version());
                std::process::exit(0);
            }
            "doctor" => {
                doctor(&iter.collect::<Vec<_>>())?;
                std::process::exit(0);
            }
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
    Ok(args)
}

fn initialize(
    client: &Client,
    args: &Args,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
) -> Result<(), String> {
    let mut session = args.session.clone();
    if session.is_none() && args.cont {
        session = last_session(client).ok();
    }
    if let Some(id) = session.clone() {
        if args.fork {
            session = Some(
                string(
                    &client.request("POST", &format!("/session/{id}/fork"), Some("{}"))?,
                    "id",
                )
                .ok_or("failed to fork session")?,
            );
        }
    }
    if let Some(session) = session {
        activate(client, state, session)?;
        state.lock().map_err(|_| "state lock failed")?.notice(
            "native Android Rust TUI active; type /doctor for runtime details or /help for commands",
        );
        dirty.store(true, Ordering::SeqCst);
        return Ok(());
    }
    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.status = String::from("home");
        locked.title = String::from("new session");
        locked.close_panel();
    }
    dirty.store(true, Ordering::SeqCst);
    Ok(())
}

fn activate(client: &Client, state: &Arc<Mutex<State>>, session: String) -> Result<(), String> {
    let info = client.request("GET", &format!("/session/{session}"), None)?;
    let title = string(&info, "title").unwrap_or_else(|| session.clone());
    let index = client.request(
        "GET",
        &format!("/session/{session}/message/index?limit=40"),
        None,
    )?;
    let ids = objects(&index)
        .iter()
        .filter_map(|item| string(item, "id"))
        .collect::<Vec<_>>();
    let chunks = if ids.is_empty() {
        String::new()
    } else {
        client.request(
            "POST",
            &format!("/session/{session}/message/chunk"),
            Some(&format!(
                "{{\"messageIDs\":[{}]}}",
                ids.iter()
                    .map(|item| json(item))
                    .collect::<Vec<_>>()
                    .join(",")
            )),
        )?
    };
    let sidebar = client
        .request("GET", "/file/status", None)
        .map(|body| file_rows(&body))
        .unwrap_or_default();

    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.session = Some(session.clone());
    locked.title = title.clone();
    locked.status = String::from("idle");
    locked.messages.clear();
    locked.close_panel();
    locked.sidebar = sidebar;
    locked.sync_tab(&session, &title);
    for item in objects(&index) {
        if let (Some(id), Some(role)) = (string(&item, "id"), string(&item, "role")) {
            locked.message(&id, &session, &role);
        }
    }
    for chunk in objects(&chunks) {
        if let Some(message) = string(&chunk, "messageID") {
            if let Some(parts) = array_value(&chunk, "parts") {
                for part in objects(&parts) {
                    apply_part(&mut locked, &message, &part);
                }
            }
        }
    }
    Ok(())
}

fn last_session(client: &Client) -> Result<String, String> {
    let body = client.request("GET", "/session?roots=true&limit=1", None)?;
    let first = objects(&body)
        .into_iter()
        .next()
        .ok_or("no previous session found")?;
    string(&first, "id").ok_or_else(|| String::from("no previous session found"))
}

fn current_session(state: &Arc<Mutex<State>>) -> Result<String, String> {
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .session
        .clone()
        .ok_or_else(|| String::from("missing session"))
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
    let session = create_session(client)?;
    activate(client, state, session.clone())?;
    Ok(session)
}

fn session_post(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    action: &str,
    notice: Option<&str>,
) -> Result<bool, String> {
    let session = current_session(state)?;
    client.request("POST", &format!("/session/{session}/{action}"), Some("{}"))?;
    if let Some(text) = notice {
        state.lock().map_err(|_| "state lock failed")?.notice(text);
    }
    dirty.store(true, Ordering::SeqCst);
    Ok(true)
}

fn session_delete(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    action: &str,
    notice: &str,
) -> Result<bool, String> {
    let session = current_session(state)?;
    client.request("DELETE", &format!("/session/{session}/{action}"), None)?;
    state
        .lock()
        .map_err(|_| "state lock failed")?
        .notice(notice);
    dirty.store(true, Ordering::SeqCst);
    Ok(true)
}

fn marker(active: bool) -> &'static str {
    if active {
        "*"
    } else {
        " "
    }
}

fn tab_target(state: &Arc<Mutex<State>>, value: &str) -> Result<String, String> {
    let locked = state.lock().map_err(|_| "state lock failed")?;
    if value.is_empty() {
        return Ok(String::new());
    }
    if let Ok(index) = value.parse::<usize>() {
        return Ok(locked
            .tabs
            .get(index.saturating_sub(1))
            .map(|item| item.id.clone())
            .unwrap_or_default());
    }
    Ok(value.to_string())
}

fn next_tab(state: &Arc<Mutex<State>>, forward: bool) -> Result<Option<String>, String> {
    let locked = state.lock().map_err(|_| "state lock failed")?;
    if locked.tabs.is_empty() {
        return Ok(None);
    }
    let current = locked.session.as_deref();
    let index = locked
        .tabs
        .iter()
        .position(|item| Some(item.id.as_str()) == current)
        .unwrap_or(0);
    let next = if forward {
        (index + 1) % locked.tabs.len()
    } else {
        (index + locked.tabs.len() - 1) % locked.tabs.len()
    };
    Ok(locked.tabs.get(next).map(|item| item.id.clone()))
}

fn command_rows(query: &str) -> Vec<String> {
    let sections = [
        (
            "Session",
            "/sessions /children /messages /timeline /new /session <id> /tabs /tab <n> /next /prev /close /fork /rename <title>",
        ),
        (
            "Agent",
            "/models [query] /model provider/model /providers /agents /agent <name> /mcps",
        ),
        (
            "Workspace",
            "/summary /files [dir] /attach <file> /open <file> /edit /save /diagnostics /close-editor[!] /diff [dismiss] /status /queue /stash /list /pop /share /unshare /compact /pause /resume /interrupt",
        ),
        ("System", "/doctor /runtime /shell /autocomplete /themes /keybinds /clipboard /title <title> /suspend /plugins /shells /orgs /clear /help /exit"),
    ];
    let needle = query.to_lowercase();
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

fn runtime_rows(state: &State) -> Vec<String> {
    vec![
        format!("mode: {}", state.runtime),
        format!("version: {}", state.version),
        format!("runtime path: {}", state.runtime_path),
        String::from("renderer: rust-native; target renderer: ratatui/crossterm"),
        String::from("install check: slopcode doctor android --json"),
    ]
}

fn complete_rows(input: &Buffer) -> Vec<String> {
    if input.cursor != input.len() || !input.text.starts_with('/') || input.text.contains(' ') {
        return Vec::new();
    }
    COMMANDS
        .iter()
        .filter(|item| item.starts_with(&input.text))
        .map(|item| item.to_string())
        .collect()
}

fn session_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let id = string(&item, "id")?;
            let title = string(&item, "title").unwrap_or_else(|| String::from("untitled"));
            Some(format!("{}  {}", short(&id), title))
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from("No sessions found")]
    } else {
        rows
    }
}

fn model_rows(body: &str, query: &str) -> Vec<String> {
    let needle = query.to_lowercase();
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let provider = string(&item, "providerID")?;
            let id = string(&item, "id")?;
            let name = string(&item, "name").unwrap_or_else(|| id.clone());
            let row = format!("{provider}/{id}  {name}");
            if needle.is_empty() || row.to_lowercase().contains(&needle) {
                Some(row)
            } else {
                None
            }
        })
        .take(20)
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from(
            "No models found. Use /model provider/model to set one.",
        )]
    } else {
        rows
    }
}

fn provider_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let id = string(&item, "id")?;
            let name = string(&item, "name").unwrap_or_else(|| id.clone());
            Some(format!("{id}  {name}"))
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from("No providers configured")]
    } else {
        rows
    }
}

fn agent_rows(current: Option<&str>) -> Vec<String> {
    ["build", "plan", "general", "explore", "docs", "translator"]
        .iter()
        .map(|name| format!("{} {name}", marker(current == Some(*name))))
        .collect()
}

fn file_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let file = string(&item, "path").or_else(|| string(&item, "file"))?;
            let status = string(&item, "status")
                .or_else(|| string(&item, "type"))
                .unwrap_or_else(|| String::from("changed"));
            Some(format!("{status:>10}  {file}"))
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from("No changed files")]
    } else {
        rows
    }
}

fn explorer_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let file = string(&item, "path")?;
            let kind = string(&item, "type").unwrap_or_else(|| String::from("file"));
            if kind == "directory" {
                Some(format!("dir  {file}/"))
            } else {
                Some(format!("file {file} [attach] [open]"))
            }
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from("No files found in this workspace.")]
    } else {
        rows
    }
}

fn status_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let status = string(&item, "phase")
                .or_else(|| string(&item, "type"))
                .unwrap_or_else(|| String::from("idle"));
            Some(format!("session status {status}"))
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![body.to_string()]
    } else {
        rows
    }
}

fn diff_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let file = string(&item, "file").or_else(|| string(&item, "path"))?;
            Some(format!("diff {file}"))
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from("No diff entries")]
    } else {
        rows
    }
}

fn editor_rows(editor: &Editor) -> Vec<String> {
    let mut rows = vec![
        format!("file {}", editor.file),
        format!("dirty {}", if editor.dirty { "yes" } else { "no" }),
        format!("diff {}", if editor.diff { "open" } else { "dismissed" }),
    ];
    if editor.diagnostics.is_empty() {
        rows.push(String::from("diagnostics clean"));
    } else {
        rows.push(String::from("diagnostics"));
        rows.extend(editor.diagnostics.iter().take(8).cloned());
    }
    if !editor.preview.is_empty() {
        rows.push(String::from("snapshot preview"));
        rows.extend(
            editor
                .preview
                .iter()
                .take(8)
                .map(|line| format!("  {line}")),
        );
    }
    rows
}

fn diagnostic_rows(body: &str) -> Vec<String> {
    let rows = array_value(body, "diagnostics")
        .map(|items| {
            objects(&items)
                .into_iter()
                .filter_map(|item| {
                    let severity =
                        string(&item, "severity").unwrap_or_else(|| String::from("warning"));
                    let message = string(&item, "message")?;
                    Some(format!("{severity}: {message}"))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if rows.is_empty() {
        vec![String::from("diagnostics clean")]
    } else {
        rows
    }
}

fn editor_from(body: &str, fallback: &str) -> Option<Editor> {
    Some(Editor {
        id: string(body, "id")?,
        file: string(body, "file").unwrap_or_else(|| fallback.to_string()),
        dirty: boolean(body, "dirty").unwrap_or(false),
        diff: boolean(body, "diff").unwrap_or(false),
        diagnostics: Vec::new(),
        preview: Vec::new(),
    })
}

fn editor_snapshot(client: &Client, session: &str, editor: &Editor) -> Result<Editor, String> {
    let body = client.request(
        "GET",
        &format!(
            "/editor/{}/snapshot?sessionID={}",
            editor.id,
            encode_query(session)
        ),
        None,
    )?;
    Ok(Editor {
        id: editor.id.clone(),
        file: string(&body, "file").unwrap_or_else(|| editor.file.clone()),
        dirty: boolean(&body, "dirty").unwrap_or(editor.dirty),
        diff: boolean(&body, "diff").unwrap_or(editor.diff),
        diagnostics: diagnostic_rows(&body),
        preview: editor_preview_rows(&body)
            .unwrap_or_else(|| editor.preview.clone()),
    })
}

fn editor_preview_rows(body: &str) -> Option<Vec<String>> {
    if let Some(content) = string(body, "content") {
        return Some(content.lines().take(8).map(|line| line.to_string()).collect());
    }
    let rows = array_value(body, "rows")?;
    let mut out = Vec::new();
    for row in arrays(&rows).into_iter().take(8) {
        let text = objects(&row)
            .into_iter()
            .filter_map(|item| string(&item, "text"))
            .collect::<Vec<_>>()
            .join("");
        out.push(text);
    }
    Some(out)
}

fn editor_save(client: &Client, session: &str, editor: &Editor) -> Result<Editor, String> {
    let body = client.request(
        "POST",
        &format!(
            "/editor/{}/save?sessionID={}",
            editor.id,
            encode_query(session)
        ),
        None,
    )?;
    Ok(editor_from(&body, &editor.file).unwrap_or(Editor {
        dirty: false,
        ..editor.clone()
    }))
}

fn editor_dismiss_diff(client: &Client, session: &str, editor: &Editor) -> Result<Editor, String> {
    let body = client.request(
        "POST",
        &format!(
            "/editor/{}/diff/dismiss?sessionID={}",
            editor.id,
            encode_query(session)
        ),
        None,
    )?;
    Ok(editor_from(&body, &editor.file).unwrap_or(Editor {
        diff: false,
        ..editor.clone()
    }))
}

fn message_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let id = string(&item, "id")?;
            let role = string(&item, "role").unwrap_or_else(|| String::from("message"));
            Some(format!("{}  {}", short(&id), role))
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from("No messages found")]
    } else {
        rows
    }
}

fn child_rows(body: &str) -> Vec<String> {
    let rows = objects(body)
        .into_iter()
        .filter_map(|item| {
            let id = string(&item, "id")?;
            let title = string(&item, "title").unwrap_or_else(|| String::from("untitled"));
            Some(format!("{}  {}", short(&id), title))
        })
        .collect::<Vec<_>>();
    if rows.is_empty() {
        vec![String::from("No child sessions")]
    } else {
        rows
    }
}

fn queue_rows(state: &State) -> Vec<String> {
    vec![
        format!("status {}", state.status),
        format!("queued {}", state.queue),
        format!("mode {}", if state.shell { "shell" } else { "normal" }),
    ]
}

fn stash_rows(state: &State) -> Vec<String> {
    if state.stash.is_empty() {
        return vec![String::from("No stashed prompts")];
    }
    state
        .stash
        .iter()
        .enumerate()
        .map(|(index, item)| format!("{}  {}", index + 1, item.replace('\n', " ")))
        .collect()
}

fn submit_prompt(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    text: &str,
) -> Result<bool, String> {
    submit_prompt_record(client, state, dirty, text, true)
}

fn submit_prompt_record(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    text: &str,
    record: bool,
) -> Result<bool, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(true);
    }
    if trimmed.starts_with('/') {
        return command(client, state, dirty, trimmed);
    }
    let session = ensure_session(client, state)?;
    let (model, agent, shell, attached) = {
        let locked = state.lock().map_err(|_| "state lock failed")?;
        (
            locked.model.clone(),
            locked.agent.clone(),
            locked.shell,
            locked.attached_files.clone(),
        )
    };
    if shell {
        let mut body = format!("{{\"command\":{}", json(trimmed));
        if let Some(agent) = agent {
            body.push_str(&format!(",\"agent\":{}", json(&agent)));
        }
        if let Some(model) = model.and_then(|item| parse_model(&item)) {
            body.push_str(&format!(
                ",\"model\":{{\"providerID\":{},\"modelID\":{}}}",
                json(&model.0),
                json(&model.1)
            ));
        }
        body.push('}');
        client.request("POST", &format!("/session/{session}/shell"), Some(&body))?;
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        if record {
            locked.history_push(trimmed);
        }
        locked.shell = false;
        locked.status = String::from("sent");
        dirty.store(true, Ordering::SeqCst);
        return Ok(true);
    }
    let msg = id("message");
    let part = id("part");
    let mut payload = attached
        .iter()
        .map(|file| {
            format!(
                "{{\"id\":{},\"type\":\"file\",\"path\":{}}}",
                json(&id("part")),
                json(file)
            )
        })
        .collect::<Vec<_>>();
    payload.push(format!(
        "{{\"id\":{},\"type\":\"text\",\"text\":{}}}",
        json(&part),
        json(trimmed)
    ));
    let mut body = format!(
        "{{\"messageID\":{},\"parts\":[{}]",
        json(&msg),
        payload.join(",")
    );
    if let Some(agent) = agent {
        body.push_str(&format!(",\"agent\":{}", json(&agent)));
    }
    if let Some(model) = model.and_then(|item| parse_model(&item)) {
        body.push_str(&format!(
            ",\"model\":{{\"providerID\":{},\"modelID\":{}}}",
            json(&model.0),
            json(&model.1)
        ));
    }
    body.push('}');
    client.request(
        "POST",
        &format!("/session/{session}/prompt_async"),
        Some(&body),
    )?;
    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        if record {
            locked.history_push(trimmed);
        }
        if locked.status != "idle" {
            locked.queue += 1;
        }
        locked.status = String::from("sent");
        locked.attached_files.clear();
    }
    dirty.store(true, Ordering::SeqCst);
    Ok(true)
}
fn short(id: &str) -> String {
    if id.len() <= 12 {
        id.to_string()
    } else {
        id[..12].to_string()
    }
}

fn encode_query(input: &str) -> String {
    input
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            b' ' => String::from("+"),
            _ => format!("%{byte:02X}"),
        })
        .collect::<Vec<_>>()
        .join("")
}

fn create_session(client: &Client) -> Result<String, String> {
    let body = client.request("POST", "/session", Some("{}"))?;
    string(&body, "id").ok_or_else(|| format!("failed to create session: {body}"))
}

fn session_required(name: &str) -> bool {
    matches!(
        name,
        "summary"
            | "sidebar"
            | "files"
            | "open"
            | "edit"
            | "save"
            | "diagnostics"
            | "close-editor"
            | "close-editor!"
            | "children"
            | "messages"
            | "history"
            | "timeline"
            | "share"
            | "unshare"
            | "fork"
            | "rename"
            | "title"
            | "pause"
            | "resume"
            | "revert"
            | "unrevert"
            | "compact"
            | "summarize"
            | "diff"
    )
}

fn command(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    line: &str,
) -> Result<bool, String> {
    let mut parts = line[1..].splitn(2, ' ');
    let name = parts.next().unwrap_or("");
    let value = parts.next().unwrap_or("").trim();
    if session_required(name) {
        ensure_session(client, state)?;
    }
    match name {
        "exit" | "quit" | "q" => Ok(false),
        "help" | "commands" | "command" => {
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Command Palette", command_rows(value));
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "doctor" | "runtime" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            let rows = runtime_rows(&locked);
            locked.panel("Android Runtime", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "new" => {
            let session = create_session(client)?;
            activate(client, state, session)?;
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "continue" => {
            let session = last_session(client)?;
            activate(client, state, session)?;
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "sessions" => {
            let body = client.request("GET", "/session?roots=true&limit=20", None)?;
            let rows = session_rows(&body);
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            for item in objects(&body) {
                if let (Some(id), Some(title)) = (string(&item, "id"), string(&item, "title")) {
                    locked.sync_tab(&id, &title);
                }
            }
            locked.panel("Sessions", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "session" | "tab" => {
            let target = if name == "tab" {
                tab_target(state, value)?
            } else {
                value.to_string()
            };
            if target.is_empty() {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice(if name == "tab" {
                        "usage: /tab <number|id>"
                    } else {
                        "usage: /session <id>"
                    });
            } else {
                activate(client, state, target)?;
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "tabs" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            let current = locked.session.clone();
            let active_dirty = locked.editor.as_ref().is_some_and(|editor| editor.dirty);
            let rows = if locked.tabs.is_empty() {
                vec![String::from("No open tabs")]
            } else {
                locked
                    .tabs
                    .iter()
                    .enumerate()
                    .map(|(index, tab)| {
                        let is_current = current.as_deref() == Some(tab.id.as_str());
                        let dirty = if is_current && active_dirty { " *" } else { "" };
                        format!(
                            "{} {} {}{} [tab: /tab {}] [close: /close]",
                            index + 1,
                            marker(is_current),
                            tab.title,
                            dirty,
                            index + 1
                        )
                    })
                    .collect()
            };
            locked.panel("Tabs", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "next" | "prev" => {
            if let Some(session) = next_tab(state, name == "next")? {
                activate(client, state, session)?;
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "close" => {
            let next = {
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                if let Some(current) = locked.session.clone() {
                    let index = locked
                        .tabs
                        .iter()
                        .position(|item| item.id == current)
                        .unwrap_or(0);
                    locked.tabs.retain(|item| item.id != current);
                    let next = locked
                        .tabs
                        .get(index.min(locked.tabs.len().saturating_sub(1)))
                        .map(|item| item.id.clone());
                    if next.is_some() {
                        locked.notice("closed current tab");
                    } else {
                        locked.session = None;
                        locked.messages.clear();
                        locked.panel = None;
                        locked.sidebar_visible = false;
                        locked.editor = None;
                        locked.editor_focus = false;
                        locked.active_file = None;
                        locked.title = String::from("Home");
                        locked.notice("closed last tab");
                    }
                    next
                } else {
                    locked.notice("no active tab");
                    None
                }
            };
            if let Some(session) = next {
                activate(client, state, session)?;
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "model" => {
            if value.is_empty() {
                let rows = model_rows(&client.request("GET", "/v2/model", None)?, "");
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .panel("Models", rows);
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
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "models" => {
            let rows = model_rows(&client.request("GET", "/v2/model", None)?, value);
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Models", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "providers" | "connect" => {
            let rows = provider_rows(&client.request("GET", "/v2/provider", None)?);
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Providers", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "agent" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if value.is_empty() {
                let current = locked.agent.clone();
                let rows = agent_rows(current.as_deref());
                locked.panel("Agents", rows);
            } else {
                locked.agent = Some(value.to_string());
                locked.notice(format!("agent {value}"));
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "agents" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            let current = locked.agent.clone();
            let rows = agent_rows(current.as_deref());
            locked.panel("Agents", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "files" => {
            let rows = if value.is_empty() || value == "." {
                explorer_rows(&client.request("GET", "/file?path=", None)?)
            } else {
                explorer_rows(&client.request(
                    "GET",
                    &format!("/file?path={}", encode_query(value)),
                    None,
                )?)
            };
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.sidebar_visible = true;
            locked.sidebar_mode = String::from("files");
            locked.sidebar_files = rows.clone();
            locked.notice("Sidebar overlay");
            locked.panel("Files", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "summary" | "sidebar" => {
            let rows = file_rows(&client.request("GET", "/file/status", None)?);
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.sidebar_visible = true;
            locked.sidebar_mode = String::from("summary");
            locked.sidebar = rows;
            locked.notice("Sidebar overlay");
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "open" => {
            if value.is_empty() {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice("usage: /open <file>");
            } else {
                let session = current_session(state)?;
                let body = client.request(
                    "POST",
                    "/editor",
                    Some(&format!(
                        "{{\"sessionID\":{},\"file\":{},\"size\":{{\"rows\":24,\"cols\":80}}}}",
                        json(&session),
                        json(value)
                    )),
                )?;
                let mut editor = editor_from(&body, value)
                    .ok_or_else(|| format!("invalid editor response: {body}"))?;
                if let Ok(content) = client.request(
                    "GET",
                    &format!("/file/content?path={}", encode_query(value)),
                    None,
                ) {
                    if let Some(text) = string(&content, "content") {
                        editor.preview =
                            text.lines().take(8).map(|line| line.to_string()).collect();
                    }
                }
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.active_file = Some(value.to_string());
                locked.open_files.retain(|item| item != value);
                locked.open_files.push(value.to_string());
                locked.editor = Some(editor.clone());
                locked.panel("Editor", editor_rows(&editor));
                locked.notice(format!("opened editor {value}"));
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "edit" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if locked.editor.is_some() {
                locked.editor_focus = true;
                locked.notice("editor input focus; Ctrl-S saves, Ctrl-D dismisses diff, Ctrl-Q returns to prompt");
            } else {
                locked.notice("no active editor; use /open <file>");
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "save" => {
            let session = current_session(state)?;
            let editor = state
                .lock()
                .map_err(|_| "state lock failed")?
                .editor
                .clone()
                .ok_or("no active editor")?;
            let saved = editor_save(client, &session, &editor)?;
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.editor = Some(saved.clone());
            locked.panel("Editor", editor_rows(&saved));
            locked.notice(format!("saved {}", saved.file));
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "diagnostics" => {
            let session = current_session(state)?;
            let editor = state
                .lock()
                .map_err(|_| "state lock failed")?
                .editor
                .clone()
                .ok_or("no active editor")?;
            let snapshot = editor_snapshot(client, &session, &editor)?;
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.editor = Some(snapshot.clone());
            locked.panel("Diagnostics", snapshot.diagnostics.clone());
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "close-editor" | "close-editor!" => {
            let session = current_session(state)?;
            let editor = state
                .lock()
                .map_err(|_| "state lock failed")?
                .editor
                .clone()
                .ok_or("no active editor")?;
            let latest = editor_snapshot(client, &session, &editor).unwrap_or(editor);
            if latest.dirty && name != "close-editor!" {
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.editor = Some(latest);
                locked.notice("editor has unsaved changes; use /save or /close-editor!");
                dirty.store(true, Ordering::SeqCst);
                return Ok(true);
            }
            client.request(
                "DELETE",
                &format!("/editor/{}?sessionID={}", latest.id, encode_query(&session)),
                None,
            )?;
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.open_files.retain(|item| item != &latest.file);
            locked.active_file = None;
            locked.editor = None;
            locked.editor_focus = false;
            locked.notice("closed editor");
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "attach" => {
            if value.is_empty() {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice("usage: /attach <file>");
            } else {
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                if !locked.attached_files.iter().any(|item| item == value) {
                    locked.attached_files.push(value.to_string());
                }
                locked.notice(format!("attached {value}"));
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "status" => {
            let rows = status_rows(&client.request("GET", "/session/status", None)?);
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Status", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "children" => {
            let session = current_session(state)?;
            let body = client.request("GET", &format!("/session/{session}/children"), None)?;
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Child Sessions", child_rows(&body));
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "messages" | "history" | "timeline" => {
            let session = current_session(state)?;
            let body = client.request(
                "GET",
                &format!("/session/{session}/message/index?limit=20"),
                None,
            )?;
            state.lock().map_err(|_| "state lock failed")?.panel(
                if name == "timeline" {
                    "Timeline"
                } else {
                    "Messages"
                },
                message_rows(&body),
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "share" => session_post(client, state, dirty, "share", Some("shared session")),
        "unshare" => session_delete(client, state, dirty, "share", "unshared session"),
        "fork" => {
            let session = current_session(state)?;
            let body = client.request("POST", &format!("/session/{session}/fork"), Some("{}"))?;
            if let Some(id) = string(&body, "id") {
                activate(client, state, id)?;
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "rename" | "title" => {
            if value.is_empty() {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice(if name == "title" {
                        "usage: /title <title>"
                    } else {
                        "usage: /rename <title>"
                    });
            } else {
                let session = current_session(state)?;
                let body = client.request(
                    "PATCH",
                    &format!("/session/{session}"),
                    Some(&format!("{{\"title\":{}}}", json(value))),
                )?;
                let title = string(&body, "title").unwrap_or_else(|| value.to_string());
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.title = title.clone();
                locked.sync_tab(&session, &title);
                locked.notice(if name == "title" {
                    "updated terminal title"
                } else {
                    "renamed session"
                });
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "pause" => session_post(client, state, dirty, "pause", Some("paused session")),
        "resume" => session_post(client, state, dirty, "resume", Some("resumed session")),
        "queue" => {
            let locked = state.lock().map_err(|_| "state lock failed")?;
            let rows = queue_rows(&locked);
            drop(locked);
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Prompt Queue", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "stash" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if locked.input.text.trim().is_empty() {
                locked.notice("nothing to stash");
            } else {
                let text = locked.input.clear();
                locked.stash.push(text);
                locked.notice("stashed prompt");
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "list" | "stashes" => {
            let locked = state.lock().map_err(|_| "state lock failed")?;
            let rows = stash_rows(&locked);
            drop(locked);
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Prompt Stash", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "pop" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if let Some(text) = locked.stash.pop() {
                locked.input.set(text);
                locked.notice("restored stashed prompt");
            } else {
                locked.notice("no stashed prompts");
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "autocomplete" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            let rows = complete_rows(&locked.input);
            complete_command(&mut locked.input);
            if rows.len() > 1 {
                locked.panel("Command Matches", rows);
                locked.notice("autocomplete has multiple matches");
            } else {
                locked.notice("autocomplete applied");
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "revert" => {
            if value.is_empty() {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice("usage: /revert <message-id>");
            } else {
                let session = current_session(state)?;
                client.request(
                    "POST",
                    &format!("/session/{session}/revert"),
                    Some(&format!("{{\"messageID\":{}}}", json(value))),
                )?;
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice("reverted message");
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "unrevert" => {
            let session = current_session(state)?;
            client.request("POST", &format!("/session/{session}/unrevert"), Some("{}"))?;
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .notice("restored reverted messages");
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "compact" | "summarize" => {
            let session = current_session(state)?;
            let model = state
                .lock()
                .map_err(|_| "state lock failed")?
                .model
                .clone()
                .and_then(|item| parse_model(&item));
            if let Some((provider, model)) = model {
                client.request(
                    "POST",
                    &format!("/session/{session}/summarize"),
                    Some(&format!(
                        "{{\"providerID\":{},\"modelID\":{}}}",
                        json(&provider),
                        json(&model)
                    )),
                )?;
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice("compaction queued");
            } else {
                state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .notice("select a model before /compact");
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "diff" => {
            let session = current_session(state)?;
            if value == "dismiss" {
                let editor = state
                    .lock()
                    .map_err(|_| "state lock failed")?
                    .editor
                    .clone()
                    .ok_or("no active editor")?;
                let updated = editor_dismiss_diff(client, &session, &editor)?;
                let mut locked = state.lock().map_err(|_| "state lock failed")?;
                locked.editor = Some(updated.clone());
                locked.panel("Editor", editor_rows(&updated));
                locked.notice("dismissed editor diff");
                dirty.store(true, Ordering::SeqCst);
                return Ok(true);
            }
            let rows = diff_rows(&client.request(
                "GET",
                &format!("/session/{session}/diff/index"),
                None,
            )?);
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .panel("Diff", rows);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "theme" | "themes" => {
            state.lock().map_err(|_| "state lock failed")?.panel(
                "Themes",
                vec![
                    String::from("Android Rust TUI follows the Termux terminal theme."),
                    String::from(
                        "Full theme switching belongs in the ratatui/crossterm renderer pass.",
                    ),
                ],
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "keybind" | "keybinds" | "keys" => {
            state.lock().map_err(|_| "state lock failed")?.panel(
                "Keybinds",
                vec![
                    String::from("Enter submits, Ctrl-D exits, Esc closes panels."),
                    String::from("Arrows move cursor/history; Alt-B/Alt-F move by word."),
                    String::from(
                        "F12 stashes and F13 restores the prompt where terminals support them.",
                    ),
                ],
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "clipboard" | "copy" | "paste" => {
            state.lock().map_err(|_| "state lock failed")?.panel(
                "Clipboard",
                vec![
                    String::from("Bracketed paste is supported in the Android Rust TUI."),
                    String::from("System clipboard access should use Termux:API commands in the Rust TUI."),
                    String::from("Use termux-clipboard-get or termux-clipboard-set outside SlopCode for OS clipboard sync."),
                ],
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "suspend" => {
            state.lock().map_err(|_| "state lock failed")?.panel(
                "Suspend",
                vec![
                    String::from("Terminal job control handles Ctrl-Z in Termux."),
                    String::from("The Android Rust TUI keeps suspend discoverable without Bun/OpenTUI hooks."),
                ],
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "plugins" | "plugin" => {
            state.lock().map_err(|_| "state lock failed")?.panel(
                "Plugins",
                vec![
                    String::from("Plugin and MCP commands stay discoverable on Android."),
                    String::from(
                        "Install and configure plugins with the same project config used by Linux.",
                    ),
                    String::from(
                        "Native plugin UI mounting needs the shared declarative plugin protocol.",
                    ),
                ],
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "shell" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.shell = !locked.shell;
            let text = if locked.shell {
                "shell mode enabled; next prompt runs as a shell command"
            } else {
                "shell mode disabled"
            };
            locked.notice(text);
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "shells" => {
            state.lock().map_err(|_| "state lock failed")?.panel(
                "Shell",
                vec![
                    String::from("Use /shell to toggle shell mode for the next prompt."),
                    String::from("Shell mode sends the prompt to the session shell route."),
                ],
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "mcps" | "orgs" => {
            state.lock().map_err(|_| "state lock failed")?.panel(
                "Integrations",
                vec![
                    String::from("Manage MCPs, providers, and orgs in config or Linux TUI."),
                    String::from("Android Rust TUI keeps these commands discoverable for parity."),
                ],
            );
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "clear" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.close_panel();
            locked.notices.clear();
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "interrupt" => {
            if let Some(session) = state
                .lock()
                .map_err(|_| "state lock failed")?
                .session
                .clone()
            {
                client.request("POST", &format!("/session/{session}/abort"), Some("{}"))?;
            }
            Ok(true)
        }
        _ => {
            state
                .lock()
                .map_err(|_| "state lock failed")?
                .notice(format!("unknown command: /{name}"));
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
    }
}

fn input(
    client: &Client,
    state: &Arc<Mutex<State>>,
    dirty: &Arc<AtomicBool>,
    done: &Arc<AtomicBool>,
    data: &[u8],
) -> Result<bool, String> {
    let text = String::from_utf8_lossy(data).to_string();
    let mut submits = Vec::new();
    let mut exit = false;
    let mut permission = None;
    let mut question = None;
    let mut editor_action = None;
    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        if locked.permission.is_some() {
            for (offset, ch) in text.char_indices() {
                let mut clear = false;
                if let Some(active) = locked.permission.clone() {
                    if active.reject.is_some() {
                        let current = active.reject.clone().unwrap_or_default();
                        match ch {
                            '\u{3}' | '\u{4}' => exit = true,
                            '\u{1b}' => {
                                if let Some(item) = locked.permission.as_mut() {
                                    item.reject = None;
                                }
                            }
                            '\r' | '\n' => {
                                let perm = locked.permission.take().unwrap();
                                locked.permissions.retain(|item| item.id != perm.id);
                                locked.permission_index = locked
                                    .permission_index
                                    .min(locked.permissions.len().saturating_sub(1));
                                locked.permission =
                                    locked.permissions.get(locked.permission_index).cloned();
                                permission = Some((
                                    perm.id,
                                    perm.session,
                                    String::from("reject"),
                                    current.trim().to_string(),
                                ));
                                clear = true;
                            }
                            '\u{7f}' | '\u{8}' => {
                                if let Some(item) = locked.permission.as_mut() {
                                    item.reject = Some(
                                        current
                                            .chars()
                                            .take(current.chars().count().saturating_sub(1))
                                            .collect(),
                                    );
                                }
                            }
                            ch if !ch.is_control() => {
                                if let Some(item) = locked.permission.as_mut() {
                                    item.reject = Some(format!("{current}{ch}"));
                                }
                            }
                            _ => {}
                        }
                        if let Some(item) = locked.permission.clone() {
                            if let Some(saved) = locked
                                .permissions
                                .iter_mut()
                                .find(|perm| perm.id == item.id)
                            {
                                saved.reject = item.reject;
                            }
                        }
                    } else {
                        match ch {
                            'o' => {
                                let perm = locked.permission.take().unwrap();
                                locked.permissions.retain(|item| item.id != perm.id);
                                locked.permission_index = locked
                                    .permission_index
                                    .min(locked.permissions.len().saturating_sub(1));
                                locked.permission =
                                    locked.permissions.get(locked.permission_index).cloned();
                                permission = Some((
                                    perm.id,
                                    perm.session,
                                    String::from("once"),
                                    String::new(),
                                ));
                                clear = true;
                            }
                            'a' => {
                                let perm = locked.permission.take().unwrap();
                                locked.permissions.retain(|item| item.id != perm.id);
                                locked.permission_index = locked
                                    .permission_index
                                    .min(locked.permissions.len().saturating_sub(1));
                                locked.permission =
                                    locked.permissions.get(locked.permission_index).cloned();
                                permission = Some((
                                    perm.id,
                                    perm.session,
                                    String::from("always"),
                                    String::new(),
                                ));
                                clear = true;
                            }
                            'r' => {
                                if let Some(item) = locked.permission.as_mut() {
                                    item.reject = Some(String::new());
                                }
                            }
                            'n' => {
                                if !locked.permissions.is_empty() {
                                    locked.permission_index =
                                        (locked.permission_index + 1) % locked.permissions.len();
                                    locked.permission =
                                        locked.permissions.get(locked.permission_index).cloned();
                                    locked.notice("next permission");
                                }
                            }
                            'p' => {
                                if !locked.permissions.is_empty() {
                                    locked.permission_index =
                                        (locked.permission_index + locked.permissions.len() - 1)
                                            % locked.permissions.len();
                                    locked.permission =
                                        locked.permissions.get(locked.permission_index).cloned();
                                    locked.notice("previous permission");
                                }
                            }
                            '\u{1b}' => {
                                let perm = locked.permission.take().unwrap();
                                locked.permissions.retain(|item| item.id != perm.id);
                                locked.permission_index = locked
                                    .permission_index
                                    .min(locked.permissions.len().saturating_sub(1));
                                locked.permission =
                                    locked.permissions.get(locked.permission_index).cloned();
                                permission = Some((
                                    perm.id,
                                    perm.session,
                                    String::from("reject"),
                                    String::new(),
                                ));
                                clear = true;
                            }
                            '\u{3}' | '\u{4}' => exit = true,
                            _ => {}
                        }
                    }
                }
                if clear {
                    if text[offset + ch.len_utf8()..]
                        .chars()
                        .any(|item| item == '\u{3}' || item == '\u{4}')
                    {
                        exit = true;
                    }
                    break;
                }
            }
        } else if locked.question.is_some() {
            question_input(&mut locked, &text, &mut question, &mut exit);
        } else if locked.editor_focus && locked.editor.is_some() {
            let keys = editor_focus_input(&mut locked, &text);
            if keys.blur {
                locked.editor_focus = false;
                locked.notice("prompt input focus");
            }
            if let (Some(session), Some(editor)) = (locked.session.clone(), locked.editor.clone()) {
                editor_action = Some(EditorInputAction {
                    session,
                    editor,
                    messages: keys.messages,
                    save: keys.save,
                    dismiss: keys.dismiss,
                    blur: keys.blur,
                });
            }
        } else {
            prompt_input(&mut locked, &text, &mut submits, &mut exit);
        }
    }
    if let Some((id, session, reply, reason)) = permission {
        let body = if reason.is_empty() {
            format!("{{\"reply\":{}}}", json(&reply))
        } else {
            format!(
                "{{\"reply\":{},\"reason\":{}}}",
                json(&reply),
                json(&reason)
            )
        };
        client.request(
            "POST",
            &format!("/permission/{id}/reply?sessionID={session}"),
            Some(&body),
        )?;
    }
    if let Some((id, session, body)) = question {
        client.request(
            "POST",
            &format!("/question/{id}/reply?sessionID={session}"),
            Some(&body),
        )?;
    }
    if let Some(action) = editor_action {
        for message in &action.messages {
            client.editor_message(&action.session, &action.editor.id, message)?;
        }
        if action.save {
            let saved = editor_save(client, &action.session, &action.editor)?;
            state.lock().map_err(|_| "state lock failed")?.editor = Some(saved);
        }
        if action.dismiss {
            let current = state
                .lock()
                .map_err(|_| "state lock failed")?
                .editor
                .clone()
                .unwrap_or_else(|| action.editor.clone());
            let updated = editor_dismiss_diff(client, &action.session, &current)?;
            state.lock().map_err(|_| "state lock failed")?.editor = Some(updated);
        }
        if !action.messages.is_empty() || action.save || action.dismiss || action.blur {
            let current = { state.lock().map_err(|_| "state lock failed")?.editor.clone() };
            if let Some(current) = current {
                if let Ok(snapshot) = editor_snapshot(client, &action.session, &current) {
                    state.lock().map_err(|_| "state lock failed")?.editor = Some(snapshot);
                }
            }
        }
    }
    if exit {
        done.store(true, Ordering::SeqCst);
        return Ok(true);
    }
    for text in submits {
        if !submit_prompt_record(client, state, dirty, &text, false)? {
            return Ok(true);
        }
    }
    dirty.store(true, Ordering::SeqCst);
    Ok(false)
}

const COMMANDS: &[&str] = &[
    "/doctor",
    "/runtime",
    "/new",
    "/sessions",
    "/children",
    "/messages",
    "/history",
    "/timeline",
    "/session",
    "/tabs",
    "/tab",
    "/next",
    "/prev",
    "/close",
    "/models",
    "/model",
    "/providers",
    "/connect",
    "/agents",
    "/agent",
    "/files",
    "/summary",
    "/sidebar",
    "/attach",
    "/open",
    "/edit",
    "/save",
    "/diagnostics",
    "/close-editor",
    "/status",
    "/queue",
    "/stash",
    "/list",
    "/pop",
    "/share",
    "/unshare",
    "/fork",
    "/rename",
    "/title",
    "/revert",
    "/unrevert",
    "/pause",
    "/resume",
    "/compact",
    "/summarize",
    "/diff",
    "/themes",
    "/theme",
    "/keybinds",
    "/clipboard",
    "/suspend",
    "/plugins",
    "/shells",
    "/shell",
    "/autocomplete",
    "/mcps",
    "/orgs",
    "/commands",
    "/help",
    "/clear",
    "/interrupt",
    "/exit",
    "/quit",
];

fn prompt_input(state: &mut State, text: &str, submits: &mut Vec<String>, exit: &mut bool) {
    let mut index = 0;
    while index < text.len() {
        if let Some(paste) = state.paste.as_mut() {
            if let Some(end) = text[index..].find("\x1b[201~") {
                paste.push_str(&text[index..index + end]);
                let value = state.paste.take().unwrap();
                state.input.insert(&normalize_paste(&value));
                index += end + "\x1b[201~".len();
                continue;
            }
            paste.push_str(&text[index..]);
            break;
        }
        let rest = &text[index..];
        if rest.starts_with("\x1b[200~") {
            state.paste = Some(String::new());
            index += "\x1b[200~".len();
            continue;
        }
        if rest.starts_with("\x1b[A") {
            state.history_move(-1);
            index += 3;
            continue;
        }
        if rest.starts_with("\x1b[B") {
            state.history_move(1);
            index += 3;
            continue;
        }
        if rest.starts_with("\x1b[D") {
            state.input.left();
            index += 3;
            continue;
        }
        if rest.starts_with("\x1b[C") {
            state.input.right();
            index += 3;
            continue;
        }
        if rest.starts_with("\x1b[H") || rest.starts_with("\x1b[1~") {
            state.input.home();
            index += if rest.starts_with("\x1b[1~") { 4 } else { 3 };
            continue;
        }
        if rest.starts_with("\x1b[24~") || rest.starts_with("[24~") {
            if !state.input.text.trim().is_empty() {
                let text = state.input.clear();
                state.stash.push(text);
                state.notice("stashed prompt");
            }
            index += if rest.starts_with("\x1b") { 5 } else { 4 };
            continue;
        }
        if rest.starts_with("\x1b[25~") || rest.starts_with("[25~") {
            if let Some(text) = state.stash.pop() {
                state.input.set(text);
                state.notice("restored stashed prompt");
            }
            index += if rest.starts_with("\x1b") { 5 } else { 4 };
            continue;
        }
        if rest.starts_with("\x1b[F") || rest.starts_with("\x1b[4~") {
            state.input.end();
            index += if rest.starts_with("\x1b[4~") { 4 } else { 3 };
            continue;
        }
        if rest.starts_with("\x1b[3~") {
            state.input.delete();
            index += 4;
            continue;
        }
        if rest.starts_with("\x1bb") || rest.starts_with("\x1bB") {
            state.input.word_left();
            index += 2;
            continue;
        }
        if rest.starts_with("\x1bf") || rest.starts_with("\x1bF") {
            state.input.word_right();
            index += 2;
            continue;
        }
        let ch = rest.chars().next().unwrap();
        index += ch.len_utf8();
        match ch {
            '\u{3}' => *exit = true,
            '\u{4}' => {
                if state.input.text.is_empty() {
                    *exit = true;
                } else {
                    state.input.delete();
                }
            }
            '\r' | '\n' => {
                let value = state.input.clear();
                let trimmed = value.trim();
                if !trimmed.is_empty() && !trimmed.starts_with('/') {
                    state.history_push(trimmed);
                }
                submits.push(value);
                state.history_index = None;
                state.history_draft.clear();
            }
            '\u{1b}' => state.close_panel(),
            '\t' => {
                let rows = complete_rows(&state.input);
                complete_command(&mut state.input);
                if rows.len() > 1 {
                    state.panel("Command Matches", rows);
                    state.notice("autocomplete has multiple matches");
                }
            }
            '\u{1}' => state.input.home(),
            '\u{5}' => state.input.end(),
            '\u{15}' => state.input.kill_before(),
            '\u{b}' => state.input.kill_after(),
            '\u{18}' => {
                if !state.input.text.trim().is_empty() {
                    let text = state.input.clear();
                    state.stash.push(text);
                    state.notice("stashed prompt");
                }
            }
            '\u{19}' => {
                if let Some(text) = state.stash.pop() {
                    state.input.set(text);
                    state.notice("restored stashed prompt");
                }
            }
            '\u{17}' => state.input.delete_word_before(),
            '\u{7f}' | '\u{8}' => state.input.backspace(),
            ch if ch >= ' ' => state.input.insert(&ch.to_string()),
            _ => {}
        }
    }
}

fn editor_focus_input(state: &mut State, text: &str) -> EditorKeys {
    let mut action = EditorKeys::default();
    let mut index = 0;
    while index < text.len() {
        if let Some(paste) = state.paste.as_mut() {
            if let Some(end) = text[index..].find("\x1b[201~") {
                paste.push_str(&text[index..index + end]);
                let value = state.paste.take().unwrap();
                action
                    .messages
                    .push(format!("{{\"type\":\"paste\",\"text\":{}}}", json(&value)));
                index += end + "\x1b[201~".len();
                continue;
            }
            paste.push_str(&text[index..]);
            break;
        }
        let rest = &text[index..];
        if rest.starts_with("\x1b[200~") {
            state.paste = Some(String::new());
            index += "\x1b[200~".len();
            continue;
        }
        let special = [
            ("\x1b[A", "<Up>"),
            ("\x1b[B", "<Down>"),
            ("\x1b[D", "<Left>"),
            ("\x1b[C", "<Right>"),
            ("\x1b[H", "<Home>"),
            ("\x1b[F", "<End>"),
            ("\x1b[1~", "<Home>"),
            ("\x1b[4~", "<End>"),
            ("\x1b[3~", "<Del>"),
            ("\x1b[5~", "<PageUp>"),
            ("\x1b[6~", "<PageDown>"),
        ];
        if let Some((seq, key)) = special.iter().find(|(seq, _)| rest.starts_with(*seq)) {
            action.messages.push(editor_key(key));
            index += seq.len();
            continue;
        }
        let ch = rest.chars().next().unwrap();
        index += ch.len_utf8();
        match ch {
            '\u{1b}' | '\u{11}' => action.blur = true,
            '\u{13}' => action.save = true,
            '\u{4}' => action.dismiss = true,
            '\r' | '\n' => action.messages.push(editor_key("<CR>")),
            '\t' => action.messages.push(editor_key("<Tab>")),
            '\u{7f}' | '\u{8}' => action.messages.push(editor_key("<BS>")),
            '<' => action.messages.push(editor_key("<LT>")),
            ch if ch >= ' ' => action.messages.push(editor_key(&ch.to_string())),
            _ => {}
        }
    }
    action
}

fn editor_key(key: &str) -> String {
    format!("{{\"type\":\"input\",\"keys\":{}}}", json(key))
}

fn question_input(
    state: &mut State,
    text: &str,
    reply: &mut Option<(String, String, String)>,
    exit: &mut bool,
) {
    let mut index = 0;
    while index < text.len() {
        let rest = &text[index..];
        if rest.starts_with("\x1b[D") {
            if let Some(question) = state.question.as_mut() {
                question.input.left();
            }
            index += 3;
            continue;
        }
        if rest.starts_with("\x1b[C") {
            if let Some(question) = state.question.as_mut() {
                question.input.right();
            }
            index += 3;
            continue;
        }
        let ch = rest.chars().next().unwrap();
        index += ch.len_utf8();
        match ch {
            '\u{3}' | '\u{4}' => *exit = true,
            '\r' | '\n' => {
                if let Some(body) = question_submit(state) {
                    if let Some(active) = state.question.take() {
                        *reply = Some((active.id, active.session, body));
                    }
                }
            }
            '\u{1}' => {
                if let Some(question) = state.question.as_mut() {
                    question.input.home();
                }
            }
            '\u{5}' => {
                if let Some(question) = state.question.as_mut() {
                    question.input.end();
                }
            }
            '\u{7f}' | '\u{8}' => {
                if let Some(question) = state.question.as_mut() {
                    question.input.backspace();
                }
            }
            ch if ch >= ' ' => {
                if let Some(question) = state.question.as_mut() {
                    question.input.insert(&ch.to_string());
                }
            }
            _ => {}
        }
    }
}

fn question_submit(state: &mut State) -> Option<String> {
    let question = state.question.as_mut()?;
    let item = question.items.get(question.index)?;
    let answer = parse_answer(&question.input.text, item);
    if answer.is_empty() {
        state.notice("answer required");
        return None;
    }
    question.answers.push(answer);
    question.input.clear();
    if question.index + 1 < question.items.len() {
        question.index += 1;
        return None;
    }
    Some(format!(
        "{{\"answers\":[{}]}}",
        question
            .answers
            .iter()
            .map(|items| format!(
                "[{}]",
                items
                    .iter()
                    .map(|item| json(item))
                    .collect::<Vec<_>>()
                    .join(",")
            ))
            .collect::<Vec<_>>()
            .join(",")
    ))
}

fn parse_answer(input: &str, question: &QuestionItem) -> Vec<String> {
    let text = input.trim();
    if text.is_empty() {
        return Vec::new();
    }
    let tokens = if question.multiple {
        text.split(',')
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>()
    } else {
        vec![text]
    };
    let result = tokens
        .iter()
        .flat_map(|token| {
            let index = token
                .parse::<usize>()
                .ok()
                .and_then(|item| question.options.get(item.saturating_sub(1)));
            if let Some(label) = index {
                return vec![label.clone()];
            }
            if let Some(label) = question
                .options
                .iter()
                .find(|item| item.eq_ignore_ascii_case(token))
            {
                return vec![label.clone()];
            }
            if question.custom {
                return vec![token.to_string()];
            }
            Vec::new()
        })
        .collect::<Vec<_>>();
    if question.multiple {
        result
    } else {
        result.into_iter().take(1).collect()
    }
}

fn normalize_paste(input: &str) -> String {
    input.replace("\r\n", "\n").replace('\r', "\n")
}

fn complete_command(input: &mut Buffer) {
    if input.cursor != input.len() || !input.text.starts_with('/') || input.text.contains(' ') {
        return;
    }
    let matches = COMMANDS
        .iter()
        .filter(|item| item.starts_with(&input.text))
        .collect::<Vec<_>>();
    if matches.len() == 1 {
        input.set(format!("{} ", matches[0]));
    }
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
    stream.write_all(format!("GET {}{} HTTP/1.1\r\nHost: {}:{}\r\nAccept: text/event-stream\r\nx-slopcode-daemon-token: {}\r\nConnection: close\r\n\r\n", url.base, "/event", url.host, url.port, client.token).as_bytes()).map_err(|err| err.to_string())?;
    let mut raw = Vec::new();
    let mut buf = [0u8; 4096];
    let mut body = String::new();
    let mut headers = false;
    loop {
        if done.load(Ordering::SeqCst) {
            break;
        }
        let count = stream.read(&mut buf).map_err(|err| err.to_string())?;
        if count == 0 {
            break;
        }
        if !headers {
            raw.extend_from_slice(&buf[..count]);
            if let Some(pos) = find(&raw, b"\r\n\r\n") {
                body.push_str(&String::from_utf8_lossy(&raw[pos + 4..]));
                headers = true;
            }
        } else {
            body.push_str(&String::from_utf8_lossy(&buf[..count]));
        }
        while let Some(pos) = body.find("\n\n").or_else(|| body.find("\r\n\r\n")) {
            let block = body[..pos].to_string();
            body = body[pos
                + if body.as_bytes().get(pos) == Some(&b'\r') {
                    4
                } else {
                    2
                }..]
                .to_string();
            if let Some(event) = parse_sse(&block) {
                apply_event(state, &event);
                dirty.store(true, Ordering::SeqCst);
            }
        }
    }
    Ok(())
}

fn apply_event(state: &Arc<Mutex<State>>, event: &str) {
    let kind = string(event, "type").unwrap_or_default();

    let props = object_value(event, "properties").unwrap_or_else(|| event.to_string());
    if let Ok(mut locked) = state.lock() {
        match kind.as_str() {
            "server.connected" => locked.notice("connected"),
            "session.status" => {
                if same_session(&locked, &props) {
                    let status = object_value(&props, "status").unwrap_or_default();
                    locked.status = string(&status, "phase")
                        .or_else(|| string(&status, "type"))
                        .unwrap_or_else(|| String::from("idle"));
                    if locked.status == "idle" {
                        locked.queue = 0;
                    }
                }
            }
            "session.created" | "session.updated" => {
                if let Some(info) = object_value(&props, "info") {
                    if let Some(id) = string(&info, "id") {
                        let title = string(&info, "title").unwrap_or_else(|| id.clone());
                        locked.sync_tab(&id, &title);
                        if Some(id.as_str()) == locked.session.as_deref() {
                            locked.title = title;
                        }
                    }
                }
            }
            "message.updated" => {
                if let Some(info) = object_value(&props, "info") {
                    if let (Some(id), Some(session), Some(role)) = (
                        string(&info, "id"),
                        string(&info, "sessionID"),
                        string(&info, "role"),
                    ) {
                        if Some(session.as_str()) == locked.session.as_deref() {
                            locked.message(&id, &session, &role);
                        }
                    }
                }
            }
            "message.part.updated" => {
                if let Some(part) = object_value(&props, "part") {
                    let message = string(&part, "messageID").unwrap_or_else(|| id("message"));
                    apply_part(&mut locked, &message, &part);
                }
            }
            "message.part.delta" => {
                if string(&props, "field").as_deref() == Some("text") {
                    if let (Some(message), Some(delta)) =
                        (string(&props, "messageID"), string(&props, "delta"))
                    {
                        let session = string(&props, "sessionID")
                            .unwrap_or_else(|| locked.session.clone().unwrap_or_default());
                        if Some(session.as_str()) == locked.session.as_deref() {
                            let msg = locked.message(&message, &session, "assistant");
                            msg.text.push_str(&delta);
                        }
                    }
                }
            }
            "permission.asked" => {
                if same_session(&locked, &props) {
                    let patterns = array_value(&props, "patterns")
                        .map(|arr| strings(&arr))
                        .unwrap_or_default();
                    let metadata = object_value(&props, "metadata").unwrap_or_default();
                    let next = Permission {
                        id: string(&props, "id").unwrap_or_default(),
                        session: string(&props, "sessionID").unwrap_or_default(),
                        permission: string(&props, "permission")
                            .unwrap_or_else(|| String::from("tool")),
                        patterns,
                        file: string(&metadata, "filepath").or_else(|| string(&metadata, "file")),
                        diff: string(&metadata, "diff"),
                        source: string(&props, "source")
                            .or_else(|| string(&metadata, "source"))
                            .or_else(|| {
                                string(&metadata, "childSessionID")
                                    .map(|item| format!("child {item}"))
                            }),
                        reason: string(&props, "reason"),
                        reject: None,
                    };
                    locked.permissions.retain(|item| item.id != next.id);
                    locked.permissions.push(next.clone());
                    locked.permission_index = locked.permissions.len().saturating_sub(1);
                    locked.permission = Some(next);
                    locked.notice("permission requested");
                }
            }
            "permission.replied" => {
                let id = string(&props, "id").unwrap_or_default();
                locked.permissions.retain(|item| item.id != id);
                locked.permission_index = locked
                    .permission_index
                    .min(locked.permissions.len().saturating_sub(1));
                locked.permission = locked.permissions.get(locked.permission_index).cloned();
            }
            "question.asked" => {
                if same_session(&locked, &props) {
                    if let Some(next) = question_from_props(&props) {
                        locked.question = Some(next);
                        locked.notice("question requested");
                    }
                }
            }
            "question.replied" | "question.rejected" => {
                if same_session(&locked, &props) {
                    locked.question = None;
                }
            }
            "session.error" => locked
                .notice(string(&props, "name").unwrap_or_else(|| String::from("session error"))),
            _ => {}
        }
    }
}

fn question_from_props(props: &str) -> Option<Question> {
    let id = string(props, "id")?;
    let session = string(props, "sessionID")?;
    let items = objects(&array_value(props, "questions")?)
        .into_iter()
        .map(|item| {
            let options = array_value(&item, "options")
                .map(|value| {
                    objects(&value)
                        .into_iter()
                        .filter_map(|option| string(&option, "label"))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            QuestionItem {
                header: string(&item, "header").unwrap_or_else(|| String::from("Question")),
                question: string(&item, "question").unwrap_or_default(),
                options,
                multiple: boolean(&item, "multiple").unwrap_or(false),
                custom: boolean(&item, "custom").unwrap_or(true),
            }
        })
        .collect::<Vec<_>>();
    if items.is_empty() {
        return None;
    }
    Some(Question {
        id,
        session,
        items,
        index: 0,
        answers: Vec::new(),
        input: Buffer::default(),
    })
}

fn apply_part(state: &mut State, message: &str, part: &str) {
    let session =
        string(part, "sessionID").unwrap_or_else(|| state.session.clone().unwrap_or_default());
    if Some(session.as_str()) != state.session.as_deref() {
        return;
    }
    let msg = state.message(message, &session, "assistant");
    if string(part, "type").as_deref() == Some("text") {
        msg.text = string(part, "text").unwrap_or_default();
    }
    if string(part, "type").as_deref() == Some("tool") {
        let tool = string(part, "tool").unwrap_or_else(|| String::from("tool"));
        let state_json = object_value(part, "state").unwrap_or_default();
        let status = string(&state_json, "status").unwrap_or_else(|| String::from("pending"));
        let suffix = string(&state_json, "error")
            .map(|item| format!(": {item}"))
            .unwrap_or_default();
        let line = format!("tool {tool} {status} [expanded]{suffix}");
        if !msg.tools.iter().any(|item| item == &line) {
            msg.tools.push(line);
        }
        if let Some(output) = string(&state_json, "output") {
            let rows: Vec<&str> = output.lines().collect();
            for line in rows.iter().take(8) {
                let preview = format!("output {line}");
                if !msg.tools.iter().any(|item| item == &preview) {
                    msg.tools.push(preview);
                }
            }
            if rows.len() > 8 {
                let preview = format!("... {} more line(s)", rows.len() - 8);
                if !msg.tools.iter().any(|item| item == &preview) {
                    msg.tools.push(preview);
                }
            }
        }
        let input = object_value(&state_json, "input");
        let input_diff = input.as_ref().and_then(|item| string(item, "diff"));
        let metadata_diff = object_value(part, "metadata").and_then(|item| string(&item, "diff"));
        if let Some(diff) = metadata_diff.or(input_diff) {
            let heading = String::from("diff preview");
            if !msg.tools.iter().any(|item| item == &heading) {
                msg.tools.push(heading);
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
                let preview = format!("diff {line}");
                if !msg.tools.iter().any(|item| item == &preview) {
                    msg.tools.push(preview);
                }
            }
        }
    }
}

impl Client {
    fn request(&self, method: &str, path: &str, body: Option<&str>) -> Result<String, String> {
        let url = parse_url(&self.url)?;
        let body = body.unwrap_or("");
        let mut stream = connect(&url.host, url.port)?;
        stream.set_read_timeout(Some(Duration::from_secs(10))).ok();
        stream.set_write_timeout(Some(Duration::from_secs(10))).ok();
        let request = format!("{method} {}{} HTTP/1.1\r\nHost: {}:{}\r\nAccept: application/json\r\nContent-Type: application/json\r\nx-slopcode-daemon-token: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", url.base, path, url.host, url.port, self.token, body.len(), body);
        stream
            .write_all(request.as_bytes())
            .map_err(|err| err.to_string())?;
        response(&read_response(&mut stream)?)
    }

    fn editor_message(&self, session: &str, editor: &str, message: &str) -> Result<(), String> {
        let url = parse_url(&self.url)?;
        let path = format!(
            "{}{}",
            url.base,
            format!("/editor/{editor}/connect?sessionID={}", encode_query(session))
        );
        let mut stream = connect(&url.host, url.port)?;
        stream.set_read_timeout(Some(Duration::from_secs(10))).ok();
        stream.set_write_timeout(Some(Duration::from_secs(10))).ok();
        let request = format!(
            "GET {path} HTTP/1.1\r\nHost: {}:{}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nx-slopcode-daemon-token: {}\r\n\r\n",
            url.host, url.port, self.token
        );
        stream
            .write_all(request.as_bytes())
            .map_err(|err| err.to_string())?;
        let raw = read_response(&mut stream)?;
        let head = String::from_utf8_lossy(&raw);
        if !head.starts_with("HTTP/1.1 101") && !head.starts_with("HTTP/1.0 101") {
            return Err(format!("editor websocket upgrade failed: {head}"));
        }
        stream
            .write_all(&websocket_text_frame(message.as_bytes()))
            .map_err(|err| err.to_string())?;
        stream.flush().map_err(|err| err.to_string())?;
        Ok(())
    }
}

fn websocket_text_frame(payload: &[u8]) -> Vec<u8> {
    let mut out = vec![0x81];
    let mask = [0x37, 0xfa, 0x21, 0x3d];
    if payload.len() < 126 {
        out.push(0x80 | payload.len() as u8);
    } else if payload.len() <= u16::MAX as usize {
        out.push(0x80 | 126);
        out.extend_from_slice(&(payload.len() as u16).to_be_bytes());
    } else {
        out.push(0x80 | 127);
        out.extend_from_slice(&(payload.len() as u64).to_be_bytes());
    }
    out.extend_from_slice(&mask);
    for (index, byte) in payload.iter().enumerate() {
        out.push(byte ^ mask[index % mask.len()]);
    }
    out
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
    let mut buf = [0u8; 4096];
    let split = loop {
        let count = stream.read(&mut buf).map_err(|err| err.to_string())?;
        if count == 0 {
            return if raw.is_empty() {
                Err(String::from("empty http response"))
            } else {
                Ok(raw)
            };
        }
        raw.extend_from_slice(&buf[..count]);
        if let Some(pos) = find(&raw, b"\r\n\r\n") {
            break pos;
        }
    };
    let head = String::from_utf8_lossy(&raw[..split]).to_ascii_lowercase();
    if head.contains("transfer-encoding: chunked") {
        while !raw.windows(5).any(|item| item == b"0\r\n\r\n") {
            let count = stream.read(&mut buf).map_err(|err| err.to_string())?;
            if count == 0 {
                break;
            }
            raw.extend_from_slice(&buf[..count]);
        }
        return Ok(raw);
    }
    if let Some(len) = content_length(&head) {
        while raw.len().saturating_sub(split + 4) < len {
            let count = stream.read(&mut buf).map_err(|err| err.to_string())?;
            if count == 0 {
                break;
            }
            raw.extend_from_slice(&buf[..count]);
        }
    }
    Ok(raw)
}

fn content_length(head: &str) -> Option<usize> {
    head.lines()
        .find_map(|line| line.strip_prefix("content-length:"))
        .and_then(|value| value.trim().parse::<usize>().ok())
}

fn response(raw: &[u8]) -> Result<String, String> {
    let split = find(raw, b"\r\n\r\n").ok_or("invalid http response")?;
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
    let text = String::from_utf8_lossy(&bytes).to_string();
    if !(200..300).contains(&status) {
        return Err(format!("http {status}: {text}"));
    }
    Ok(text)
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

struct Terminal {
    saved: String,
    active: bool,
}

impl Terminal {
    fn start() -> Result<Self, String> {
        let saved = Command::new("stty")
            .arg("-g")
            .output()
            .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
            .unwrap_or_default();
        Command::new("stty")
            .args(["raw", "-echo", "min", "0", "time", "1"])
            .status()
            .ok();
        print!("\x1b[?1049h\x1b[?25l\x1b[2J");
        io::stdout().flush().ok();
        Ok(Self {
            saved,
            active: true,
        })
    }

    fn size(&self) -> (usize, usize) {
        let out = Command::new("stty").arg("size").output().ok();
        let text = out
            .map(|item| String::from_utf8_lossy(&item.stdout).to_string())
            .unwrap_or_default();
        let mut parts = text
            .split_whitespace()
            .filter_map(|item| item.parse::<usize>().ok());
        let rows = parts.next().unwrap_or(24).max(10);
        let cols = parts.next().unwrap_or(80).max(40);
        (cols, rows)
    }

    fn stop(&mut self) {
        if !self.active {
            return;
        }
        self.active = false;
        print!("\x1b[?25h\x1b[?1049l");
        io::stdout().flush().ok();
        if !self.saved.is_empty() {
            Command::new("stty").arg(&self.saved).status().ok();
        }
    }
}

impl Drop for Terminal {
    fn drop(&mut self) {
        self.stop();
    }
}

fn center(input: &str, width: usize) -> String {
    let text = crop(input, width);
    let len = text.chars().count();
    format!("{}{}", " ".repeat(width.saturating_sub(len) / 2), text)
}

fn box_line(input: &str, inner: usize, width: usize) -> String {
    let text = crop(input, inner);
    center(
        &format!(
            "| {}{} |",
            text,
            " ".repeat(inner.saturating_sub(text.chars().count()))
        ),
        width,
    )
}

fn draw_home(state: &State, size: (usize, usize)) {
    let (width, height) = size;
    let box_width = width.min(75).max(20);
    let inner = box_width.saturating_sub(4);
    let prompt = if state.input.text.is_empty() {
        String::from("> Fix a TODO in the codebase")
    } else {
        format!("> {}", state.input.rendered()).replace('\n', "\n  ")
    };
    let mut lines = vec![
        center("SlopCode", width),
        center("terminal AI coding agent", width),
        String::new(),
        center(
            &format!("+{}+", "-".repeat(box_width.saturating_sub(2))),
            width,
        ),
    ];
    for row in wrap(&prompt, inner) {
        lines.push(box_line(&row, inner, width));
    }
    if !state.attached_files.is_empty() {
        lines.push(box_line(
            &format!("files: {}", state.attached_files.join(", ")),
            inner,
            width,
        ));
    }
    lines.push(box_line("Enter send | /commands | /doctor", inner, width));
    lines.push(center(
        &format!("+{}+", "-".repeat(box_width.saturating_sub(2))),
        width,
    ));
    if let Some(panel) = &state.panel {
        lines.push(String::new());
        lines.push(center(&format!("== {} ==", panel.title), width));
        for row in panel.rows.iter().take(10) {
            lines.extend(wrap(row, width));
        }
    }
    for notice in &state.notices {
        lines.extend(wrap(&format!("info: {notice}"), width));
    }
    let footer = vec![crop(
        &format!("{} | {} | /help", state.cwd, state.version),
        width,
    )];
    let body_height = height.saturating_sub(footer.len());
    let top = body_height.saturating_sub(lines.len()) / 2;
    let mut rows = Vec::new();
    for _ in 0..top {
        rows.push(" ".repeat(width));
    }
    rows.extend(
        lines
            .into_iter()
            .take(body_height.saturating_sub(top))
            .map(|item| pad(&item, width)),
    );
    while rows.len() < body_height {
        rows.push(" ".repeat(width));
    }
    rows.extend(footer.into_iter().map(|item| pad(&item, width)));
    print!("\x1b[H{}", rows.join("\n"));
    io::stdout().flush().ok();
}

fn draw(state: &State, size: (usize, usize)) {
    let (width, height) = size;
    if state.session.is_none()
        && state.messages.is_empty()
        && state.permission.is_none()
        && state.question.is_none()
    {
        draw_home(state, size);
        return;
    }
    let mut lines = Vec::new();
    let model = state
        .model
        .as_ref()
        .map(|item| format!(" model {item}"))
        .unwrap_or_default();
    let agent = state
        .agent
        .as_ref()
        .map(|item| format!(" agent {item}"))
        .unwrap_or_default();
    lines.push(crop(
        &format!("SlopCode Android | {}{}{}", state.status, model, agent),
        width,
    ));
    lines.push(crop(&format!("session {}", state.title), width));
    lines.push(crop(
        &format!(
            "runtime {} {} | {}",
            state.runtime, state.version, state.runtime_path
        ),
        width,
    ));
    if !state.tabs.is_empty() {
        let active_dirty = state.editor.as_ref().is_some_and(|editor| editor.dirty);
        let tabs = state
            .tabs
            .iter()
            .enumerate()
            .map(|(index, tab)| {
                let is_current = state.session.as_deref() == Some(tab.id.as_str());
                let dirty = if is_current && active_dirty { "*" } else { "" };
                format!(
                    "{}{}:{}{} [x]",
                    marker(is_current),
                    index + 1,
                    tab.title,
                    dirty
                )
            })
            .collect::<Vec<_>>()
            .join("  ");
        lines.push(crop(&format!("tabs {tabs}"), width));
    }
    if state.sidebar_visible {
        lines.push(crop(
            &format!(
                "Sidebar {} | Summary | Files | mode {}",
                if width >= 96 { "docked" } else { "overlay" },
                state.sidebar_mode
            ),
            width,
        ));
        if !state.open_files.is_empty() {
            lines.push(crop("Open Files", width));
            for file in state.open_files.iter().take(4) {
                lines.push(crop(
                    &format!(
                        "{} {file} [open] [close]",
                        if state.active_file.as_deref() == Some(file.as_str()) {
                            ">"
                        } else {
                            "-"
                        }
                    ),
                    width,
                ));
            }
        }
        if state.sidebar_mode == "files" {
            lines.push(crop("Files .", width));
            for row in state.sidebar_files.iter().take(6) {
                lines.extend(wrap(row, width));
            }
        } else {
            lines.push(crop("Modified Files", width));
            for row in state.sidebar.iter().take(6) {
                lines.extend(wrap(&format!("{row} [open]"), width));
            }
        }
    }
    if let Some(editor) = &state.editor {
        lines.push(crop(
            &format!(
                "Editor {}{}{}",
                editor.file,
                if editor.dirty { " *" } else { "" },
                if editor.diff { " diff" } else { "" }
            ),
            width,
        ));
        if state.editor_focus {
            lines.push(crop("  input focus: Ctrl-S save, Ctrl-D dismiss diff, Ctrl-Q prompt", width));
        }
        for row in editor.diagnostics.iter().take(3) {
            lines.extend(wrap(&format!("  {row}"), width));
        }
        for row in editor.preview.iter().take(3) {
            lines.extend(wrap(&format!("  {row}"), width));
        }
    }
    lines.push(String::new());
    if let Some(panel) = &state.panel {
        lines.push(crop(&format!("== {} ==", panel.title), width));
        for row in panel.rows.iter().take(12) {
            lines.extend(wrap(row, width));
        }
        lines.push(String::new());
    }
    for msg in &state.messages {
        let label = if msg.role == "user" {
            "You"
        } else {
            "Assistant"
        };
        if !msg.text.trim().is_empty() {
            lines.extend(markdown(&format!("{label}: {}", msg.text.trim()), width));
        }
        for tool in &msg.tools {
            lines.extend(wrap(&format!("  {tool}"), width));
        }
        if !msg.text.trim().is_empty() || !msg.tools.is_empty() {
            lines.push(String::new());
        }
    }
    if let Some(permission) = &state.permission {
        let source = permission
            .source
            .as_ref()
            .map(|item| format!(" source {item}"))
            .unwrap_or_default();
        lines.push(crop(
            &format!(
                "permission {}/{} {}{source}",
                state.permission_index + 1,
                state.permissions.len().max(1),
                permission.permission
            ),
            width,
        ));
        if let Some(reason) = &permission.reason {
            lines.extend(wrap(&format!("reason: {reason}"), width));
        }
        for pattern in &permission.patterns {
            lines.extend(wrap(&format!("  {pattern}"), width));
        }
        if let Some(file) = &permission.file {
            lines.extend(wrap(&format!("  file {file}"), width));
        }
        if let Some(diff) = &permission.diff {
            lines.push(String::from("  diff preview"));
            for line in diff.lines().take(6) {
                lines.extend(wrap(&format!("  {line}"), width));
            }
        }
        if let Some(reject) = &permission.reject {
            lines.extend(wrap(
                &format!(
                    "reject reason: {}",
                    if reject.is_empty() {
                        "(optional)"
                    } else {
                        reject
                    }
                ),
                width,
            ));
        }
    }
    for notice in &state.notices {
        lines.extend(wrap(&format!("info: {notice}"), width));
    }
    let footer = footer_lines(state, width);
    let body_height = height.saturating_sub(footer.len());
    let start = lines.len().saturating_sub(body_height);
    let mut rows = lines[start..]
        .iter()
        .map(|item| pad(item, width))
        .collect::<Vec<_>>();
    while rows.len() < body_height {
        rows.push(" ".repeat(width));
    }
    rows.extend(
        footer
            .into_iter()
            .map(|item| pad(&crop(&item, width), width)),
    );
    print!("\x1b[H{}", rows.join("\n"));
    io::stdout().flush().ok();
}

fn footer_lines(state: &State, width: usize) -> Vec<String> {
    if let Some(permission) = &state.permission {
        if let Some(reject) = &permission.reject {
            return wrap(
                &format!("reject | enter send, esc cancel > {reject}"),
                width,
            );
        }
        return wrap(
            &format!(
                "permission {}/{} {} {} | o once, a always, r reject, n/p switch",
                state.permission_index + 1,
                state.permissions.len().max(1),
                permission.permission,
                permission.patterns.join(", ")
            ),
            width,
        );
    }
    if let Some(question) = &state.question {
        if let Some(item) = question.items.get(question.index) {
            let options = item
                .options
                .iter()
                .enumerate()
                .map(|(index, option)| format!("{}) {}", index + 1, option))
                .collect::<Vec<_>>()
                .join("  ");
            return wrap(
                &format!(
                    "{}: {} {} > {}",
                    item.header,
                    item.question,
                    options,
                    question.input.rendered()
                ),
                width,
            );
        }
        return vec![String::from("question | enter answer")];
    }
    let hint = if state.panel.is_some() {
        " | esc close panel"
    } else {
        " | /commands"
    };
    wrap(
        &format!(
            "{}> {}{hint}",
            if state.shell { "shell " } else { "" },
            state.input.rendered()
        )
        .replace('\n', "\n  "),
        width,
    )
}

fn wrap(input: &str, width: usize) -> Vec<String> {
    let mut out = Vec::new();
    for raw in input.split('\n') {
        let mut line = raw.to_string();
        while line.chars().count() > width {
            let chunk = line.chars().take(width).collect::<String>();
            out.push(chunk);
            line = line.chars().skip(width).collect();
        }
        out.push(line);
    }
    out
}

fn markdown(input: &str, width: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut code = false;
    let mut seen = 0usize;
    for raw in input.split('\n') {
        if raw.trim_start().starts_with("```") {
            if code && seen > 12 {
                out.push(format!("... {} more code line(s)", seen - 12));
            }
            code = !code;
            seen = 0;
            out.push(raw.to_string());
            continue;
        }
        if code {
            seen += 1;
            if seen <= 12 {
                out.push(crop(raw, width));
            }
            continue;
        }
        out.extend(wrap(raw, width));
    }
    if code && seen > 12 {
        out.push(format!("... {} more code line(s)", seen - 12));
    }
    out
}

fn crop(input: &str, width: usize) -> String {
    input.chars().take(width).collect()
}

fn pad(input: &str, width: usize) -> String {
    let len = input.chars().count();
    format!("{}{}", input, " ".repeat(width.saturating_sub(len)))
}

fn parse_sse(block: &str) -> Option<String> {
    let data = block
        .lines()
        .filter_map(|line| line.strip_prefix("data:").map(str::trim_start))
        .collect::<Vec<_>>()
        .join("\n");
    if data.is_empty() {
        None
    } else {
        Some(data)
    }
}

fn same_session(state: &State, props: &str) -> bool {
    state
        .session
        .as_ref()
        .map(|session| string(props, "sessionID").as_deref() == Some(session.as_str()))
        .unwrap_or(true)
}

fn parse_model(input: &str) -> Option<(String, String)> {
    let (provider, model) = input.split_once('/')?;
    if provider.is_empty() || model.is_empty() {
        return None;
    }
    Some((provider.to_string(), model.to_string()))
}

fn id(prefix: &str) -> String {
    let head = match prefix {
        "message" => "msg",
        "part" => "prt",
        _ => prefix,
    };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let count = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{head}_{now:013}{count:04}")
}

fn json(input: &str) -> String {
    let escaped = input
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t");
    format!("\"{escaped}\"")
}

fn string(input: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":", key);
    let mut start = input.find(&needle)? + needle.len();
    while input
        .as_bytes()
        .get(start)
        .is_some_and(|b| b.is_ascii_whitespace())
    {
        start += 1;
    }
    if input.as_bytes().get(start) != Some(&b'\"') {
        return None;
    }
    start += 1;
    let mut out = String::new();
    let mut escaped = false;
    for ch in input[start..].chars() {
        if escaped {
            match ch {
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                '\\' => out.push('\\'),
                '"' => out.push('"'),
                other => out.push(other),
            }
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == '"' {
            return Some(out);
        }
        out.push(ch);
    }
    None
}

fn strings(input: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut pos = 0;
    while let Some(start) = input[pos..].find('"') {
        let sub = &input[pos + start + 1..];
        let mut value = String::new();
        let mut escaped = false;
        let mut end = 0;
        for (index, ch) in sub.char_indices() {
            if escaped {
                value.push(ch);
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == '"' {
                end = index + 1;
                break;
            }
            value.push(ch);
        }
        if end == 0 {
            break;
        }
        out.push(value);
        pos += start + end + 1;
    }
    out
}

fn object_value(input: &str, key: &str) -> Option<String> {
    value(input, key).filter(|item| item.starts_with('{'))
}

fn array_value(input: &str, key: &str) -> Option<String> {
    value(input, key).filter(|item| item.starts_with('['))
}

fn boolean(input: &str, key: &str) -> Option<bool> {
    let needle = format!("\"{}\":", key);
    let mut index = input.find(&needle)? + needle.len();
    while input
        .as_bytes()
        .get(index)
        .is_some_and(|b| b.is_ascii_whitespace())
    {
        index += 1;
    }
    if input[index..].starts_with("true") {
        return Some(true);
    }
    if input[index..].starts_with("false") {
        return Some(false);
    }
    None
}

fn value(input: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":", key);
    let mut index = input.find(&needle)? + needle.len();
    while input
        .as_bytes()
        .get(index)
        .is_some_and(|b| b.is_ascii_whitespace())
    {
        index += 1;
    }
    let first = *input.as_bytes().get(index)? as char;
    if first == '"' {
        return string(input, key).map(|item| json(&item));
    }
    let (open, close) = if first == '{' {
        ('{', '}')
    } else if first == '[' {
        ('[', ']')
    } else {
        return None;
    };
    let mut depth = 0i32;
    let mut inside = false;
    let mut escaped = false;
    for (offset, ch) in input[index..].char_indices() {
        if inside {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                inside = false;
            }
            continue;
        }
        if ch == '"' {
            inside = true;
            continue;
        }
        if ch == open {
            depth += 1;
        }
        if ch == close {
            depth -= 1;
            if depth == 0 {
                return Some(input[index..index + offset + ch.len_utf8()].to_string());
            }
        }
    }
    None
}

fn objects(input: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut start = None;
    let mut depth = 0i32;
    let mut inside = false;
    let mut escaped = false;
    for (index, ch) in input.char_indices() {
        if inside {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                inside = false;
            }
            continue;
        }
        if ch == '"' {
            inside = true;
            continue;
        }
        if ch == '{' {
            if depth == 0 {
                start = Some(index);
            }
            depth += 1;
        }
        if ch == '}' {
            depth -= 1;
            if depth == 0 {
                if let Some(pos) = start {
                    out.push(input[pos..index + 1].to_string());
                }
            }
        }
    }
    out
}

fn arrays(input: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut start = None;
    let mut depth = 0i32;
    let mut inside = false;
    let mut escaped = false;
    for (index, ch) in input.char_indices() {
        if inside {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                inside = false;
            }
            continue;
        }
        if ch == '"' {
            inside = true;
            continue;
        }
        if ch == '[' {
            depth += 1;
            if depth == 2 {
                start = Some(index);
            }
        }
        if ch == ']' {
            if depth == 2 {
                if let Some(pos) = start.take() {
                    out.push(input[pos..index + 1].to_string());
                }
            }
            depth -= 1;
        }
    }
    out
}

fn find(input: &[u8], needle: &[u8]) -> Option<usize> {
    input.windows(needle.len()).position(|item| item == needle)
}

fn chunks(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut pos = 0;
    loop {
        let end = input[pos..]
            .windows(2)
            .position(|item| item == b"\r\n")
            .ok_or("invalid chunk header")?
            + pos;
        let size = std::str::from_utf8(&input[pos..end])
            .map_err(|err| err.to_string())?
            .split(';')
            .next()
            .unwrap_or("0");
        let len = usize::from_str_radix(size.trim(), 16).map_err(|err| err.to_string())?;
        pos = end + 2;
        if len == 0 {
            break;
        }
        if pos + len > input.len() {
            return Err(String::from("truncated chunk"));
        }
        out.extend_from_slice(&input[pos..pos + len]);
        pos += len + 2;
    }
    Ok(out)
}

use std::env;
use std::io::{self, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

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

struct Permission {
    id: String,
    session: String,
    permission: String,
    patterns: Vec<String>,
}

struct State {
    session: Option<String>,
    title: String,
    status: String,
    input: String,
    model: Option<String>,
    agent: Option<String>,
    messages: Vec<Message>,
    notices: Vec<String>,
    permission: Option<Permission>,
}

impl State {
    fn new(args: &Args) -> Self {
        Self {
            session: args.session.clone(),
            title: String::from("new session"),
            status: String::from("starting"),
            input: String::new(),
            model: args.model.clone(),
            agent: args.agent.clone(),
            messages: Vec::new(),
            notices: Vec::new(),
            permission: None,
        }
    }

    fn notice(&mut self, text: impl Into<String>) {
        self.notices.push(text.into());
        if self.notices.len() > 8 {
            self.notices.remove(0);
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
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.notice("starting native Android sidecar");
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
        let mut buf = [0u8; 32];
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
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }
    Ok(args)
}

fn initialize(client: &Client, args: &Args, state: &Arc<Mutex<State>>, dirty: &Arc<AtomicBool>) -> Result<(), String> {
    let mut session = args.session.clone();
    if session.is_none() && args.cont {
        session = last_session(client).ok();
    }
    if let Some(id) = session.clone() {
        if args.fork {
            session = Some(string(&client.request("POST", &format!("/session/{id}/fork"), Some("{}"))?, "id").ok_or("failed to fork session")?);
        }
    }
    if session.is_none() {
        session = Some(create_session(client)?);
    }
    activate(client, state, session.unwrap())?;
    state.lock().map_err(|_| "state lock failed")?.notice("native Android sidecar active; type /help for commands");
    dirty.store(true, Ordering::SeqCst);
    Ok(())
}

fn activate(client: &Client, state: &Arc<Mutex<State>>, session: String) -> Result<(), String> {
    let info = client.request("GET", &format!("/session/{session}"), None)?;
    let title = string(&info, "title").unwrap_or_else(|| session.clone());
    let index = client.request("GET", &format!("/session/{session}/message/index?limit=40"), None)?;
    let ids = objects(&index)
        .iter()
        .filter_map(|item| string(item, "id"))
        .collect::<Vec<_>>();
    let chunks = if ids.is_empty() {
        String::new()
    } else {
        client.request("POST", &format!("/session/{session}/message/chunk"), Some(&format!("{{\"messageIDs\":[{}]}}", ids.iter().map(|item| json(item)).collect::<Vec<_>>().join(","))))?
    };

    let mut locked = state.lock().map_err(|_| "state lock failed")?;
    locked.session = Some(session.clone());
    locked.title = title;
    locked.status = String::from("idle");
    locked.messages.clear();
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
    let first = objects(&body).into_iter().next().ok_or("no previous session found")?;
    string(&first, "id").ok_or_else(|| String::from("no previous session found"))
}

fn create_session(client: &Client) -> Result<String, String> {
    let body = client.request("POST", "/session", Some("{}"))?;
    string(&body, "id").ok_or_else(|| format!("failed to create session: {body}"))
}

fn submit_prompt(client: &Client, state: &Arc<Mutex<State>>, dirty: &Arc<AtomicBool>, text: &str) -> Result<bool, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(true);
    }
    if trimmed.starts_with('/') {
        return command(client, state, dirty, trimmed);
    }
    let (session, model, agent) = {
        let locked = state.lock().map_err(|_| "state lock failed")?;
        (locked.session.clone().ok_or("missing session")?, locked.model.clone(), locked.agent.clone())
    };
    let msg = id("message");
    let part = id("part");
    let mut body = format!("{{\"messageID\":{},\"parts\":[{{\"id\":{},\"type\":\"text\",\"text\":{}}}]", json(&msg), json(&part), json(trimmed));
    if let Some(agent) = agent {
        body.push_str(&format!(",\"agent\":{}", json(&agent)));
    }
    if let Some(model) = model.and_then(|item| parse_model(&item)) {
        body.push_str(&format!(",\"model\":{{\"providerID\":{},\"modelID\":{}}}", json(&model.0), json(&model.1)));
    }
    body.push('}');
    client.request("POST", &format!("/session/{session}/prompt_async"), Some(&body))?;
    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        locked.status = String::from("sent");
    }
    dirty.store(true, Ordering::SeqCst);
    Ok(true)
}

fn command(client: &Client, state: &Arc<Mutex<State>>, dirty: &Arc<AtomicBool>, line: &str) -> Result<bool, String> {
    let mut parts = line[1..].splitn(2, ' ');
    let name = parts.next().unwrap_or("");
    let value = parts.next().unwrap_or("").trim();
    match name {
        "exit" | "quit" | "q" => Ok(false),
        "help" => {
            state.lock().map_err(|_| "state lock failed")?.notice("/new /sessions /session <id> /continue /model <provider/model> /agent <name> /interrupt /exit");
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
            let body = client.request("GET", "/session?roots=true&limit=10", None)?;
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            for item in objects(&body) {
                if let Some(id) = string(&item, "id") {
                    locked.notice(format!("{} {}", id, string(&item, "title").unwrap_or_else(|| String::from("untitled"))));
                }
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "session" => {
            if value.is_empty() {
                state.lock().map_err(|_| "state lock failed")?.notice("usage: /session <id>");
            } else {
                activate(client, state, value.to_string())?;
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "model" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            if parse_model(value).is_some() {
                locked.model = Some(value.to_string());
                locked.notice(format!("model {value}"));
            } else {
                locked.notice("usage: /model provider/model");
            }
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "agent" => {
            let mut locked = state.lock().map_err(|_| "state lock failed")?;
            locked.agent = if value.is_empty() { None } else { Some(value.to_string()) };
            locked.notice(if value.is_empty() { String::from("agent cleared") } else { format!("agent {value}") });
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
        "interrupt" => {
            if let Some(session) = state.lock().map_err(|_| "state lock failed")?.session.clone() {
                client.request("POST", &format!("/session/{session}/abort"), Some("{}"))?;
            }
            Ok(true)
        }
        _ => {
            state.lock().map_err(|_| "state lock failed")?.notice(format!("unknown command: /{name}"));
            dirty.store(true, Ordering::SeqCst);
            Ok(true)
        }
    }
}

fn input(client: &Client, state: &Arc<Mutex<State>>, dirty: &Arc<AtomicBool>, done: &Arc<AtomicBool>, data: &[u8]) -> Result<bool, String> {
    if data == [3] {
        let (busy, session) = {
            let locked = state.lock().map_err(|_| "state lock failed")?;
            (locked.status != "idle", locked.session.clone())
        };
        if busy {
            if let Some(session) = session {
                client.request("POST", &format!("/session/{session}/abort"), Some("{}"))?;
            }
            return Ok(false);
        }
        done.store(true, Ordering::SeqCst);
        return Ok(true);
    }
    if data == [4] {
        done.store(true, Ordering::SeqCst);
        return Ok(true);
    }
    if data == b"\x1b[A" || data == b"\x1b[B" {
        return Ok(false);
    }

    let mut submit = None;
    {
        let mut locked = state.lock().map_err(|_| "state lock failed")?;
        if locked.permission.is_some() {
            let reply = match data {
                b"o" => Some("once"),
                b"a" => Some("always"),
                b"r" | b"\x1b" => Some("reject"),
                _ => None,
            };
            if let Some(reply) = reply {
                let perm = locked.permission.take().unwrap();
                drop(locked);
                client.request("POST", &format!("/permission/{}/reply?sessionID={}", perm.id, perm.session), Some(&format!("{{\"reply\":{}}}", json(reply))))?;
                dirty.store(true, Ordering::SeqCst);
            }
            return Ok(false);
        }
        for ch in String::from_utf8_lossy(data).chars() {
            match ch {
                '\r' | '\n' => {
                    submit = Some(locked.input.clone());
                    locked.input.clear();
                }
                '\u{7f}' | '\u{8}' => {
                    locked.input.pop();
                }
                ch if ch >= ' ' => locked.input.push(ch),
                _ => {}
            }
        }
    }
    if let Some(text) = submit {
        if !submit_prompt(client, state, dirty, &text)? {
            return Ok(true);
        }
    }
    dirty.store(true, Ordering::SeqCst);
    Ok(false)
}

fn spawn_events(client: Client, state: Arc<Mutex<State>>, dirty: Arc<AtomicBool>, done: Arc<AtomicBool>) {
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

fn events_once(client: &Client, state: &Arc<Mutex<State>>, dirty: &Arc<AtomicBool>, done: &Arc<AtomicBool>) -> Result<(), String> {
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
            body = body[pos + if body.as_bytes().get(pos) == Some(&b'\r') { 4 } else { 2 }..].to_string();
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
                    locked.status = string(&status, "phase").or_else(|| string(&status, "type")).unwrap_or_else(|| String::from("idle"));
                }
            }
            "session.created" | "session.updated" => {
                if let Some(info) = object_value(&props, "info") {
                    if Some(locked.session.as_deref().unwrap_or("")) == string(&info, "id").as_deref() {
                        if let Some(title) = string(&info, "title") {
                            locked.title = title;
                        }
                    }
                }
            }
            "message.updated" => {
                if let Some(info) = object_value(&props, "info") {
                    if let (Some(id), Some(session), Some(role)) = (string(&info, "id"), string(&info, "sessionID"), string(&info, "role")) {
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
                    if let (Some(message), Some(delta)) = (string(&props, "messageID"), string(&props, "delta")) {
                        let session = string(&props, "sessionID").unwrap_or_else(|| locked.session.clone().unwrap_or_default());
                        if Some(session.as_str()) == locked.session.as_deref() {
                            let msg = locked.message(&message, &session, "assistant");
                            msg.text.push_str(&delta);
                        }
                    }
                }
            }
            "permission.asked" => {
                if same_session(&locked, &props) {
                    let patterns = array_value(&props, "patterns").map(|arr| strings(&arr)).unwrap_or_default();
                    locked.permission = Some(Permission {
                        id: string(&props, "id").unwrap_or_default(),
                        session: string(&props, "sessionID").unwrap_or_default(),
                        permission: string(&props, "permission").unwrap_or_else(|| String::from("tool")),
                        patterns,
                    });
                    locked.notice("permission requested");
                }
            }
            "permission.replied" => locked.permission = None,
            "session.error" => locked.notice(string(&props, "name").unwrap_or_else(|| String::from("session error"))),
            _ => {}
        }
    }
}

fn apply_part(state: &mut State, message: &str, part: &str) {
    let session = string(part, "sessionID").unwrap_or_else(|| state.session.clone().unwrap_or_default());
    if Some(session.as_str()) != state.session.as_deref() {
        return;
    }
    let msg = state.message(message, &session, "assistant");
    if string(part, "type").as_deref() == Some("text") {
        msg.text = string(part, "text").unwrap_or_default();
    }
    if string(part, "type").as_deref() == Some("tool") {
        let tool = string(part, "tool").unwrap_or_else(|| String::from("tool"));
        let status = object_value(part, "state").and_then(|item| string(&item, "status")).unwrap_or_else(|| String::from("pending"));
        let line = format!("tool {tool} {status}");
        if !msg.tools.iter().any(|item| item == &line) {
            msg.tools.push(line);
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
        stream.write_all(request.as_bytes()).map_err(|err| err.to_string())?;
        response(&read_response(&mut stream)?)
    }
}

fn connect(host: &str, port: u16) -> Result<TcpStream, String> {
    let addrs = (host, port).to_socket_addrs().map_err(|err| format!("resolve {host}:{port}: {err}"))?;
    let mut last = None;
    for addr in addrs {
        match TcpStream::connect_timeout(&addr, Duration::from_secs(5)) {
            Ok(stream) => return Ok(stream),
            Err(err) => last = Some(err),
        }
    }
    Err(format!("connect {host}:{port}: {}", last.map(|err| err.to_string()).unwrap_or_else(|| String::from("no address"))))
}

fn read_response(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let mut raw = Vec::new();
    let mut buf = [0u8; 4096];
    let split = loop {
        let count = stream.read(&mut buf).map_err(|err| err.to_string())?;
        if count == 0 {
            return if raw.is_empty() { Err(String::from("empty http response")) } else { Ok(raw) };
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
    let status = head.split_whitespace().nth(1).and_then(|item| item.parse::<u16>().ok()).ok_or("invalid http status")?;
    let mut bytes = raw[split + 4..].to_vec();
    if head.to_ascii_lowercase().contains("transfer-encoding: chunked") {
        bytes = chunks(&bytes)?;
    }
    let text = String::from_utf8_lossy(&bytes).to_string();
    if !(200..300).contains(&status) {
        return Err(format!("http {status}: {text}"));
    }
    Ok(text)
}

fn parse_url(input: &str) -> Result<Url, String> {
    let rest = input.strip_prefix("http://").ok_or("only http URLs are supported")?;
    let (hostport, path) = rest.split_once('/').unwrap_or((rest, ""));
    let (host, port) = match hostport.rsplit_once(':') {
        Some((host, port)) => (host.to_string(), port.parse::<u16>().map_err(|_| "invalid port")?),
        None => (hostport.to_string(), 80),
    };
    let base = if path.is_empty() { String::new() } else { format!("/{path}") };
    Ok(Url { host, port, base })
}

struct Terminal {
    saved: String,
    active: bool,
}

impl Terminal {
    fn start() -> Result<Self, String> {
        let saved = Command::new("stty").arg("-g").output().map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string()).unwrap_or_default();
        Command::new("stty").args(["raw", "-echo", "min", "0", "time", "1"]).status().ok();
        print!("\x1b[?1049h\x1b[?25l\x1b[2J");
        io::stdout().flush().ok();
        Ok(Self { saved, active: true })
    }

    fn size(&self) -> (usize, usize) {
        let out = Command::new("stty").arg("size").output().ok();
        let text = out.map(|item| String::from_utf8_lossy(&item.stdout).to_string()).unwrap_or_default();
        let mut parts = text.split_whitespace().filter_map(|item| item.parse::<usize>().ok());
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

fn draw(state: &State, size: (usize, usize)) {
    let (width, height) = size;
    let mut lines = Vec::new();
    let model = state.model.as_ref().map(|item| format!(" model {item}")).unwrap_or_default();
    let agent = state.agent.as_ref().map(|item| format!(" agent {item}")).unwrap_or_default();
    lines.push(crop(&format!("SlopCode Android | {}{}{}", state.status, model, agent), width));
    lines.push(crop(&format!("session {}", state.title), width));
    lines.push(String::new());
    for msg in &state.messages {
        let label = if msg.role == "user" { "You" } else { "Assistant" };
        if !msg.text.trim().is_empty() {
            lines.extend(wrap(&format!("{label}: {}", msg.text.trim()), width));
        }
        for tool in &msg.tools {
            lines.extend(wrap(&format!("  {tool}"), width));
        }
        if !msg.text.trim().is_empty() || !msg.tools.is_empty() {
            lines.push(String::new());
        }
    }
    for notice in &state.notices {
        lines.extend(wrap(&format!("info: {notice}"), width));
    }
    let footer = if let Some(permission) = &state.permission {
        format!("permission {} {} | o once, a always, r reject", permission.permission, permission.patterns.join(", "))
    } else {
        format!("> {}", state.input)
    };
    let body_height = height.saturating_sub(1);
    let start = lines.len().saturating_sub(body_height);
    let mut rows = lines[start..].iter().map(|item| pad(item, width)).collect::<Vec<_>>();
    while rows.len() < body_height {
        rows.push(" ".repeat(width));
    }
    rows.push(pad(&crop(&footer, width), width));
    print!("\x1b[H{}", rows.join("\n"));
    io::stdout().flush().ok();
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

fn crop(input: &str, width: usize) -> String {
    input.chars().take(width).collect()
}

fn pad(input: &str, width: usize) -> String {
    let len = input.chars().count();
    format!("{}{}", input, " ".repeat(width.saturating_sub(len)))
}

fn parse_sse(block: &str) -> Option<String> {
    let data = block.lines().filter_map(|line| line.strip_prefix("data:").map(str::trim_start)).collect::<Vec<_>>().join("\n");
    if data.is_empty() { None } else { Some(data) }
}

fn same_session(state: &State, props: &str) -> bool {
    string(props, "sessionID").as_deref() == state.session.as_deref()
}

fn parse_model(input: &str) -> Option<(String, String)> {
    let (provider, model) = input.split_once('/')?;
    if provider.is_empty() || model.is_empty() {
        return None;
    }
    Some((provider.to_string(), model.to_string()))
}

fn id(prefix: &str) -> String {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    format!("{prefix}_{now}")
}

fn json(input: &str) -> String {
    let escaped = input.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\r', "\\r").replace('\t', "\\t");
    format!("\"{escaped}\"")
}

fn string(input: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":", key);
    let mut start = input.find(&needle)? + needle.len();
    while input.as_bytes().get(start).is_some_and(|b| b.is_ascii_whitespace()) {
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

fn value(input: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":", key);
    let mut index = input.find(&needle)? + needle.len();
    while input.as_bytes().get(index).is_some_and(|b| b.is_ascii_whitespace()) {
        index += 1;
    }
    let first = *input.as_bytes().get(index)? as char;
    if first == '"' {
        return string(input, key).map(|item| json(&item));
    }
    let (open, close) = if first == '{' { ('{', '}') } else if first == '[' { ('[', ']') } else { return None };
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

fn find(input: &[u8], needle: &[u8]) -> Option<usize> {
    input.windows(needle.len()).position(|item| item == needle)
}

fn chunks(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut pos = 0;
    loop {
        let end = input[pos..].windows(2).position(|item| item == b"\r\n").ok_or("invalid chunk header")? + pos;
        let size = std::str::from_utf8(&input[pos..end]).map_err(|err| err.to_string())?.split(';').next().unwrap_or("0");
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

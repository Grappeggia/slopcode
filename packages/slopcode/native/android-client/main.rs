use std::env;
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

struct Args {
    url: String,
    token: String,
    session: Option<String>,
    cont: bool,
    model: Option<String>,
    agent: Option<String>,
    variant: Option<String>,
    prompt: Option<String>,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("{err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut args = parse()?;
    println!("SlopCode native Termux client");
    println!("Type /help for commands, /exit to quit.");
    println!();

    if args.session.is_none() && args.cont {
        args.session = last(&args).ok();
    }
    if args.session.is_none() {
        args.session = Some(create(&args)?);
    }
    println!("session {}", args.session.as_deref().unwrap_or("unknown"));
    println!();

    if let Some(prompt) = args.prompt.clone() {
        send(&args, &prompt)?;
    }

    loop {
        print!("you> ");
        io::stdout().flush().map_err(|err| err.to_string())?;
        let mut line = String::new();
        if io::stdin().read_line(&mut line).map_err(|err| err.to_string())? == 0 {
            break;
        }
        let msg = line.trim();
        if msg.is_empty() {
            continue;
        }
        match msg {
            "/exit" | "/quit" => break,
            "/help" => {
                println!("/new   start a new session");
                println!("/exit  quit");
                println!();
            }
            "/new" => {
                args.session = Some(create(&args)?);
                println!("session {}", args.session.as_deref().unwrap_or("unknown"));
                println!();
            }
            _ => send(&args, msg)?,
        }
    }
    Ok(())
}

fn parse() -> Result<Args, String> {
    let mut url = None;
    let mut token = None;
    let mut session = None;
    let mut cont = false;
    let mut model = None;
    let mut agent = None;
    let mut variant = None;
    let mut prompt = None;
    let mut iter = env::args().skip(1);
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--url" => url = iter.next(),
            "--token" => token = iter.next(),
            "--session" => session = iter.next(),
            "--continue" => cont = true,
            "--model" => model = iter.next(),
            "--agent" => agent = iter.next(),
            "--variant" => variant = iter.next(),
            "--prompt" => prompt = iter.next(),
            "--self-test" => {
                println!("slopcode-android-client ok");
                std::process::exit(0);
            }
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }
    Ok(Args {
        url: url.ok_or("missing --url")?,
        token: token.ok_or("missing --token")?,
        session,
        cont,
        model,
        agent,
        variant,
        prompt,
    })
}

fn create(args: &Args) -> Result<String, String> {
    let body = concat!(
        "{\"permission\":[",
        "{\"permission\":\"question\",\"action\":\"deny\",\"pattern\":\"*\"},",
        "{\"permission\":\"plan_enter\",\"action\":\"deny\",\"pattern\":\"*\"},",
        "{\"permission\":\"plan_exit\",\"action\":\"deny\",\"pattern\":\"*\"},",
        "{\"permission\":\"edit\",\"action\":\"allow\",\"pattern\":\"*\"}",
        "]}"
    );
    let res = http(args, "POST", "/session", Some(body))?;
    string(&res, "id").ok_or_else(|| format!("failed to create session: {res}"))
}

fn last(args: &Args) -> Result<String, String> {
    let res = http(args, "GET", "/session?roots=true&limit=1", None)?;
    string(&res, "id").ok_or_else(|| "no previous session found".to_string())
}

fn send(args: &Args, text: &str) -> Result<(), String> {
    let session = args.session.as_deref().ok_or("missing session")?;
    println!("assistant> working...");
    let mut body = String::from("{");
    body.push_str("\"parts\":[{\"type\":\"text\",\"text\":");
    body.push_str(&json(text));
    body.push_str("}]");
    if let Some(model) = &args.model {
        let (provider, model) = model
            .split_once('/')
            .ok_or_else(|| "model must use provider/model".to_string())?;
        body.push_str(",\"model\":{\"providerID\":");
        body.push_str(&json(provider));
        body.push_str(",\"modelID\":");
        body.push_str(&json(model));
        body.push('}');
    }
    if let Some(agent) = &args.agent {
        body.push_str(",\"agent\":");
        body.push_str(&json(agent));
    }
    if let Some(variant) = &args.variant {
        body.push_str(",\"variant\":");
        body.push_str(&json(variant));
    }
    body.push('}');

    let res = http(args, "POST", &format!("/session/{session}/message"), Some(&body))?;
    let texts = texts(&res);
    if texts.is_empty() {
        println!("assistant> [no text response]");
        println!();
        return Ok(());
    }
    for text in texts {
        println!("assistant> {text}");
    }
    println!();
    Ok(())
}

fn http(args: &Args, method: &str, path: &str, body: Option<&str>) -> Result<String, String> {
    let (host, port, base) = url(&args.url)?;
    let target = format!("{base}{path}");
    let mut stream = TcpStream::connect((host.as_str(), port)).map_err(|err| format!("connect {host}:{port}: {err}"))?;
    stream.set_read_timeout(Some(Duration::from_secs(60 * 60))).ok();
    let body = body.unwrap_or("");
    let request = format!(
        "{method} {target} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\nAccept: application/json\r\nContent-Type: application/json\r\nx-slopcode-daemon-token: {}\r\nContent-Length: {}\r\n\r\n{}",
        args.token,
        body.len(),
        body,
    );
    stream.write_all(request.as_bytes()).map_err(|err| err.to_string())?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|err| err.to_string())?;
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
    if head.to_ascii_lowercase().contains("transfer-encoding: chunked") {
        bytes = chunks(&bytes)?;
    }
    let text = String::from_utf8_lossy(&bytes).to_string();
    if status < 200 || status >= 300 {
        return Err(format!("http {status}: {text}"));
    }
    Ok(text)
}

fn url(input: &str) -> Result<(String, u16, String), String> {
    let rest = input.strip_prefix("http://").ok_or("only http URLs are supported")?;
    let (hostport, path) = rest.split_once('/').unwrap_or((rest, ""));
    let (host, port) = match hostport.rsplit_once(':') {
        Some((host, port)) => (host.to_string(), port.parse::<u16>().map_err(|_| "invalid port")?),
        None => (hostport.to_string(), 80),
    };
    let base = if path.is_empty() { String::new() } else { format!("/{path}") };
    Ok((host, port, base))
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
            return Err("truncated chunk".to_string());
        }
        out.extend_from_slice(&input[pos..pos + len]);
        pos += len + 2;
    }
    Ok(out)
}

fn texts(input: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut pos = 0;
    while let Some(found) = input[pos..].find("\"type\":\"text\"") {
        let start = pos + found;
        if let Some(next) = input[start..].find("\"text\":") {
            let key = start + next + "\"text\":".len();
            if let Some((value, end)) = parse_string(input, key) {
                if !value.trim().is_empty() {
                    result.push(value.trim().to_string());
                }
                pos = end;
                continue;
            }
        }
        pos = start + 1;
    }
    result
}

fn string(input: &str, key: &str) -> Option<String> {
    let pat = format!("\"{key}\":");
    let pos = input.find(&pat)? + pat.len();
    parse_string(input, pos).map(|item| item.0)
}

fn parse_string(input: &str, mut pos: usize) -> Option<(String, usize)> {
    let bytes = input.as_bytes();
    while matches!(bytes.get(pos), Some(b' ' | b'\n' | b'\r' | b'\t')) {
        pos += 1;
    }
    if bytes.get(pos) != Some(&b'\"') {
        return None;
    }
    pos += 1;
    let mut out = String::new();
    while pos < bytes.len() {
        let ch = bytes[pos];
        pos += 1;
        match ch {
            b'\"' => return Some((out, pos)),
            b'\\' => {
                let esc = *bytes.get(pos)?;
                pos += 1;
                match esc {
                    b'\"' => out.push('\"'),
                    b'\\' => out.push('\\'),
                    b'/' => out.push('/'),
                    b'b' => out.push('\u{0008}'),
                    b'f' => out.push('\u{000c}'),
                    b'n' => out.push('\n'),
                    b'r' => out.push('\r'),
                    b't' => out.push('\t'),
                    b'u' => {
                        let hex = input.get(pos..pos + 4)?;
                        pos += 4;
                        if let Ok(code) = u16::from_str_radix(hex, 16) {
                            if let Some(c) = char::from_u32(code as u32) {
                                out.push(c);
                            }
                        }
                    }
                    _ => out.push(esc as char),
                }
            }
            _ => out.push(ch as char),
        }
    }
    None
}

fn json(input: &str) -> String {
    let mut out = String::from("\"");
    for ch in input.chars() {
        match ch {
            '\"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_control() => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('\"');
    out
}

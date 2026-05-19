use std::io::{self, BufRead, Write};

fn value(line: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":\"", key);
    let start = line.find(&needle)? + needle.len();
    let mut out = String::new();
    let mut escaped = false;
    for ch in line[start..].chars() {
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

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    write!(stdout, "\x1b[?1049h\x1b[2J\x1b[H").ok();
    stdout.flush().ok();

    for line in stdin.lock().lines().map_while(Result::ok) {
        if line.contains("\"type\":\"frame\"") {
            write!(stdout, "\x1b[2J\x1b[H{}", value(&line, "text").unwrap_or_default()).ok();
            stdout.flush().ok();
            continue;
        }
        if line.contains("\"type\":\"exit\"") {
            break;
        }
    }

    write!(stdout, "\x1b[?1049l").ok();
    stdout.flush().ok();
}

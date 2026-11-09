//! Folder contract v1. Tokens originate only from the native directory picker.
use cap_std::{ambient_authority, fs::{Dir, OpenOptions}};
use same_file::Handle;
use std::{collections::HashMap, io::Write, path::PathBuf, sync::{Mutex, atomic::{AtomicU64, Ordering}}};
use tauri_plugin_dialog::DialogExt;

const MAIN: &str = "projeto.armstruct.json";
const PREVIOUS: &str = ".projeto.previous";
#[derive(Default)]
pub struct Folders(pub Mutex<HashMap<String, (PathBuf, Dir)>>);
static SEQ: AtomicU64 = AtomicU64::new(1);
#[derive(serde::Serialize)]
pub struct Choice { token: String, label: String }
fn msg(e: impl std::fmt::Display) -> String { e.to_string() }
fn guard(w: &tauri::WebviewWindow) -> Result<(), String> {
    if w.label() != "main" { return Err("Janela não autorizada".into()); }
    Ok(())
}
fn names(d: &Dir, name: &str) -> Result<(), String> {
    for e in d.entries().map_err(msg)? {
        let n = e.map_err(msg)?.file_name().to_string_lossy().to_string();
        let portable = n.trim_end_matches(&[' ', '.'][..]);
        if n != name && (portable.to_uppercase() == name.to_uppercase() || portable.to_lowercase() == name.to_lowercase()) { return Err(format!("Conflito de nome/caixa: {n}")); }
    }
    match d.symlink_metadata(name) {
        Ok(m) if m.file_type().is_symlink() => Err(format!("Link simbólico no nome administrado: {name}")),
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(msg(e)),
    }
}
fn location(path: &PathBuf, root: &Dir) -> Result<(), String> {
    let original = Handle::from_file(root.try_clone().map_err(msg)?.into_std_file()).map_err(msg)?;
    let current = Handle::from_path(path).map_err(|e| format!("Pasta indisponível; localize novamente: {e}"))?;
    if original != current { return Err("Pasta movida/substituída; localize novamente".into()); }
    Ok(())
}
fn directory(root: &Dir, create: bool) -> Result<Option<Dir>, String> {
    names(root, "save-v1")?;
    match root.open_dir("save-v1") {
        Ok(d) => Ok(Some(d)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            if !create { return Ok(None); }
            root.create_dir("save-v1").map_err(msg)?;
            Ok(Some(root.open_dir("save-v1").map_err(msg)?))
        },
        Err(e) => Err(msg(e)),
    }
}
fn content(d: &Dir) -> Result<Option<String>, String> {
    names(d, MAIN)?;
    names(d, PREVIOUS)?;
    match d.read_to_string(MAIN) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => match d.read_to_string(PREVIOUS) {
            Ok(s) => Ok(Some(s)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(msg(e)),
        },
        Err(e) => Err(msg(e)),
    }
}
fn read(root: &Dir) -> Result<Option<String>, String> {
    let Some(d) = directory(root, false)? else { return Ok(None) };
    let raw = content(&d)?;
    if raw.is_none() {
        if let Some(e) = d.entries().map_err(msg)?.next() {
            return Err(format!("save-v1 ocupado: {}. Preserve os arquivos e escolha outra pasta.", e.map_err(msg)?.file_name().to_string_lossy()));
        }
    }
    Ok(raw)
}
#[tauri::command]
pub async fn project_folder_choose(app: tauri::AppHandle, w: tauri::WebviewWindow, state: tauri::State<'_, Folders>) -> Result<Option<Choice>, String> {
    guard(&w)?;
    let picker = app.dialog().file().set_title("Pasta raiz do projeto").set_parent(&w);
    let selected = tauri::async_runtime::spawn_blocking(move || picker.blocking_pick_folder()).await.map_err(msg)?;
    let Some(path) = selected else { return Ok(None) };
    let path = path.into_path().map_err(msg)?.canonicalize().map_err(msg)?;
    let dir = Dir::open_ambient_dir(&path, ambient_authority()).map_err(msg)?;
    let token = format!("{}-{}", std::process::id(), SEQ.fetch_add(1, Ordering::SeqCst));
    let label = path.display().to_string();
    state.inner().0.lock().map_err(msg)?.insert(token.clone(), (path, dir));
    Ok(Some(Choice { token, label }))
}
#[tauri::command]
pub async fn project_folder_read(w: tauri::WebviewWindow, state: tauri::State<'_, Folders>, token: String) -> Result<Option<String>, String> {
    guard(&w)?;
    let map = state.inner().0.lock().map_err(msg)?;
    let (path, root) = map.get(&token).ok_or("Selecione novamente a pasta")?;
    location(path, root)?;
    read(root)
}
fn write(root: &Dir, data: &str, expected: Option<&str>) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(data).map_err(msg)?;
    let id = value["id"].as_str().ok_or("Projeto sem ID")?;
    if !value["schema"].as_str().unwrap_or("").starts_with("armadurastruct/") { return Err("Formato inválido".into()); }
    let d = directory(root, true)?.ok_or("Pasta indisponível")?;
    let old = content(&d)?;
    if old.as_deref() != expected { return Err("Conflito: arquivo alterado ou outro projeto. Abra existente/salve cópia.".into()); }
    if expected.is_none() {
        if let Some(e) = d.entries().map_err(msg)?.next() { return Err(format!("save-v1 ocupado: {}", e.map_err(msg)?.file_name().to_string_lossy())); }
    }
    if let Some(s) = old.as_ref() {
        let v: serde_json::Value = serde_json::from_str(s).map_err(msg)?;
        if v["id"].as_str() != Some(id) { return Err("Pasta de outro projeto".into()); }
    }
    names(&d, ".projeto.lock")?;
    let mut opts = OpenOptions::new();
    opts.write(true).create_new(true);
    let lock = d.open_with(".projeto.lock", &opts).map_err(|e| format!("Pasta ocupada/bloqueada: {e}. Se houve interrupção, preserve os arquivos; consulte a recuperação documentada."))?;
    let lock = Handle::from_file(lock.into_std()).map_err(msg)?;
    let tmp = format!(".projeto-{}-{}.tmp", std::process::id(), SEQ.fetch_add(1, Ordering::SeqCst));
    let result = (|| {
        let mut f = d.open_with(&tmp, &opts).map_err(msg)?;
        f.write_all(data.as_bytes()).map_err(msg)?;
        f.sync_all().map_err(msg)?;
        drop(f);
        if content(&d)?.as_deref() != expected { return Err("Conflito externo durante a gravação".into()); }
        if d.try_exists(MAIN).map_err(msg)? {
            if d.try_exists(PREVIOUS).map_err(msg)? {
                let backup: serde_json::Value = serde_json::from_str(&d.read_to_string(PREVIOUS).map_err(msg)?).map_err(msg)?;
                if backup["id"].as_str() != Some(id) { return Err("Backup reservado pertence a outro conteúdo; escolha outra pasta".into()); }
                d.remove_file(PREVIOUS).map_err(msg)?;
            }
            d.rename(MAIN, &d, PREVIOUS).map_err(msg)?;
        }
        d.rename(&tmp, &d, MAIN).map_err(msg)?;
        Ok(())
    })();
    // Only remove the lock created by this operation, when its identity still matches.
    let own_lock = d.open(".projeto.lock").ok().and_then(|f| Handle::from_file(f.into_std()).ok()).is_some_and(|current| current == lock);
    drop(lock);
    if own_lock { let _ = d.remove_file(".projeto.lock"); }
    result.map_err(|e: String| format!("{e}. Preserve save-v1/{MAIN}, {PREVIOUS} e o temporário {tmp}, se produzido. Nenhum arquivo do usuário foi limpo."))
}
#[tauri::command]
pub async fn project_folder_write(w: tauri::WebviewWindow, state: tauri::State<'_, Folders>, token: String, data: String, expected: Option<String>) -> Result<(), String> {
    guard(&w)?;
    let map = state.inner().0.lock().map_err(msg)?;
    let (path, root) = map.get(&token).ok_or("Selecione novamente a pasta")?;
    location(path, root)?;
    write(root, &data, expected.as_deref())
}
#[cfg(test)]
mod tests {
    use super::*;
    const A: &str = r#"{"id":"a","schema":"armadurastruct/24"}"#;
    const B: &str = r#"{"id":"a","schema":"armadurastruct/24","name":"novo"}"#;
    fn temp() -> (PathBuf, Dir) {
        let p = std::env::temp_dir().join(format!("armstruct-test-{}-{}", std::process::id(), SEQ.fetch_add(1, Ordering::SeqCst)));
        std::fs::create_dir(&p).unwrap();
        let d = Dir::open_ambient_dir(&p, ambient_authority()).unwrap();
        (p, d)
    }
    #[test]
    fn controlled_directory() {
        let (p, d) = temp();
        d.write("arquivo-do-usuario.txt", "preservar").unwrap();
        write(&d, A, None).unwrap();
        assert!(write(&d, A, None).is_err());
        write(&d, B, Some(A)).unwrap();
        let save = directory(&d, false).unwrap().unwrap();
        assert_eq!(content(&save).unwrap().as_deref(), Some(B));
        assert_eq!(save.read_to_string(PREVIOUS).unwrap(), A);
        assert!(write(&d, A, Some(A)).is_err());
        assert!(write(&d, r#"{"id":"outro","schema":"armadurastruct/24"}"#, Some(B)).is_err());
        assert_eq!(d.read_to_string("arquivo-do-usuario.txt").unwrap(), "preservar");
        // Interrupted replacement: the fallback is readable and can be resumed without deleting it.
        save.remove_file(MAIN).unwrap();
        assert_eq!(read(&d).unwrap().as_deref(), Some(A));
        write(&d, B, Some(A)).unwrap();
        assert_eq!(read(&d).unwrap().as_deref(), Some(B));
        drop(save); drop(d); std::fs::remove_dir_all(p).unwrap();
    }
    #[test]
    fn conflict_lock_and_backup_preserve_last_file() {
        let (p, d) = temp();
        write(&d, A, None).unwrap();
        let save = directory(&d, false).unwrap().unwrap();
        save.write(".projeto.lock", "outra instância").unwrap();
        assert!(write(&d, B, Some(A)).is_err());
        save.remove_file(".projeto.lock").unwrap();
        save.write(PREVIOUS, "arquivo alheio").unwrap();
        assert!(write(&d, B, Some(A)).is_err());
        assert_eq!(read(&d).unwrap().as_deref(), Some(A));
        assert_eq!(save.read_to_string(PREVIOUS).unwrap(), "arquivo alheio");
        drop(save); drop(d); std::fs::remove_dir_all(p).unwrap();
    }
    #[test]
    fn occupied_and_case_conflicts() {
        let (p, d) = temp();
        d.create_dir("SAVE-V1").unwrap();
        assert!(write(&d, A, None).is_err());
        assert_eq!(d.entries().unwrap().count(), 1);
        drop(d); std::fs::remove_dir_all(p).unwrap();
        let (p, d) = temp();
        d.create_dir("save-v1").unwrap();
        let save = directory(&d, false).unwrap().unwrap();
        save.write("arquivo.txt", "preservar").unwrap();
        assert!(read(&d).is_err()); assert!(write(&d, A, None).is_err());
        assert_eq!(save.read_to_string("arquivo.txt").unwrap(), "preservar");
        drop(save); drop(d); std::fs::remove_dir_all(p).unwrap();
    }
    #[test]
    fn portable_aliases() {
        for alias in ["save-v1.", "save-v1 ", "ſave-v1"] {
            let (p, d) = temp();
            // Windows may normalize the spelling itself; guard against the entry actually returned.
            if d.create_dir(alias).is_ok() {
                let actual = d.entries().unwrap().next().unwrap().unwrap().file_name();
                if actual != "save-v1" { assert!(read(&d).is_err()); }
            }
            drop(d); std::fs::remove_dir_all(p).unwrap();
        }
    }
    #[cfg(unix)]
    #[test]
    fn symlink_escape_and_replaced_root() {
        let (p, d) = temp(); let (outside, out) = temp();
        std::os::unix::fs::symlink(&outside, p.join("save-v1")).unwrap();
        assert!(write(&d, A, None).is_err());
        assert_eq!(out.entries().unwrap().count(), 0);
        std::fs::remove_file(p.join("save-v1")).unwrap();
        let moved = p.with_extension("moved");
        std::fs::rename(&p, &moved).unwrap(); std::fs::create_dir(&p).unwrap();
        assert!(location(&p, &d).is_err());
        drop(d); drop(out);
        std::fs::remove_dir_all(p).unwrap(); std::fs::remove_dir_all(moved).unwrap(); std::fs::remove_dir_all(outside).unwrap();
    }
}

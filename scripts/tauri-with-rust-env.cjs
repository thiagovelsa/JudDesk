const { spawn } = require("node:child_process");
const path = require("node:path");

const env = { ...process.env };
const nodeDir = path.dirname(process.execPath);

if (process.platform === "win32") {
  const userProfile =
    env.USERPROFILE ||
    `${env.HOMEDRIVE || "C:"}${env.HOMEPATH || "\\Users\\User"}`;
  const cargoBinDir = path.join(userProfile, ".cargo", "bin");

  const requiredPathEntries = [
    nodeDir,
    "C:\\Windows\\System32",
    "C:\\Windows",
    "C:\\Windows\\System32\\Wbem",
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\",
    "C:\\Windows\\System32\\OpenSSH\\",
    cargoBinDir,
  ];

  const currentPath = env.PATH || "";
  const pathParts = currentPath.split(";").filter(Boolean);
  const mergedPath = [...requiredPathEntries, ...pathParts]
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(";");

  env.PATH = mergedPath;
  env.CARGO = env.CARGO || path.join(cargoBinDir, "cargo.exe");
  env.RUSTC = env.RUSTC || path.join(cargoBinDir, "rustc.exe");
}

const tauriEntrypoint = require.resolve("@tauri-apps/cli/tauri.js");
const child = spawn(process.execPath, [tauriEntrypoint, ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

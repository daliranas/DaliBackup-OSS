## 2024-05-24 - [Command Injection]
**Vulnerability:** Found a command injection vulnerability in `src/config/sslManager.ts` where `execSync` was used with a concatenated shell command string to execute `openssl req`. System properties (like hostname or network interface IPs) were directly injected into the command string.
**Learning:** Node.js applications that invoke external binaries using `exec`/`execSync` are susceptible to shell injection if they construct the command via string concatenation, even if inputs originate from seemingly benign sources like the OS.
**Prevention:** Always use `execFile` or `execFileSync` instead, passing the binary name and an array of individual arguments separately, to bypass shell execution and argument injection vulnerabilities.

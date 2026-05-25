---
name: system-fix
description: Audit and harden a Fedora/Linux system by analyzing recent journal logs, kernel messages, and service health for driver, upgrade, configuration, and performance issues. Writes a dated checklist to ~/.claude/audits/, then executes the safe fixes. Defers high-risk fixes for user approval. Use when the user wants to fix, tune, or harden their system, especially after major upgrades (Fedora version bumps, driver swaps), or as a periodic health check. Invocation: /system-fix [duration like "30 minutes", "2 hours", "1 day", "since boot"; default 1 hour].
---

# system-fix

You are running an interactive system audit on the user's Linux box (assume Fedora unless `/etc/os-release` says otherwise). Pull recent logs, identify problems and tuning opportunities, write a dated checklist, and fix everything you can without endangering the system. Defer anything that could break login, networking, the bootloader, or hardware drivers to user approval at the end.

## Phase 0 — Parse the time window

Argument format: free-form duration phrase. Examples and how to translate them:

| Input                  | journalctl `--since` value | dmesg `--since` value |
|------------------------|-----------------------------|------------------------|
| (no arg, default)      | `'1 hour ago'`              | `'1 hour ago'`         |
| `30 minutes`           | `'30 min ago'`              | `'30 min ago'`         |
| `2 hours`              | `'2 hours ago'`             | `'2 hours ago'`        |
| `1 day` / `24 hours`   | `'1 day ago'`               | `'1 day ago'`          |
| `since boot`           | (use `-b 0` instead)        | (use `-b 0`)           |
| `last boot`            | `-b -1`                     | `--boot=-1`            |

Store the window phrase for the audit doc header.

## Phase 1 — Collect

Run as much in parallel as practical (single Bash call with `&&` chains for independent commands). All commands are read-only.

### General system

- `journalctl --list-boots | tail -3` — identify current + previous boots
- `systemctl --failed --no-pager` — failed units
- `sudo journalctl -p err --since '<since>' --no-pager` — system error level
- `sudo journalctl -p warning --since '<since>' --no-pager | head -200` — warnings
- `journalctl --user -p err --since '<since>' --no-pager` — user-session errors
- `sudo dmesg --since '<since>' 2>/dev/null | grep -iE 'error|fail|warn|fault|panic|oops|bug:|mce|thermal|i/o error'` — kernel ring
- `coredumpctl list --since '<since>' --no-pager 2>/dev/null` — recent crashes

### Subsystem deep dives

**Graphics**
- `lspci -nnk | grep -A3 -iE 'vga|3d|display'` — what's there, driver bound
- `lsmod | grep -iE 'nvidia|nouveau|amdgpu|i915|radeon'`
- `nvidia-smi 2>&1 | head -20` (if NVIDIA present)
- `sudo journalctl -b 0 --no-pager | grep -iE 'nvidia|nvrm|drm:|amdgpu|nouveau|kwin_wayland.*(fail|error|drm)' | head -40`
- `dkms status 2>&1 | head` — DKMS module health
- `systemctl status akmods 2>&1 | head -10`

**Audio**
- `pactl info | grep -E 'Server Name|Default Sink'`
- `pactl list sinks short`
- `pactl list cards short`
- `journalctl --user -u 'pipewire*' 'wireplumber*' --since '<since>' --no-pager 2>/dev/null | grep -iE 'error|warn|fail|xrun|underrun'`

**Plasma / desktop**
- `journalctl --user --since '<since>' --no-pager | grep -iE 'plasma|kwin|kded|sddm|discover' | grep -iE 'error|crash|fail' | head -30`
- `coredumpctl list --since '<since>' --no-pager 2>/dev/null | grep -iE 'plasma|kwin|kded|discover|qt'`

**Memory + pressure**
- `free -h`
- `cat /proc/pressure/memory /proc/pressure/cpu /proc/pressure/io 2>/dev/null`
- `sudo journalctl --since '<since>' --no-pager | grep -iE 'oom|killed process|out of memory'`
- `swapon --show`
- `ps -eo pid,user,rss,pmem,comm --sort=-rss 2>/dev/null | head -15` — top memory hogs

**Disk / filesystem**
- `df -h | awk 'NR==1 || ($5+0)>=80'` — partitions ≥80% full
- `sudo dmesg --since '<since>' 2>/dev/null | grep -iE 'i/o error|ext4-fs error|btrfs.*error|xfs.*error|sd[a-z].*(error|fail)|nvme.*error'`
- `journalctl -u 'systemd-fsck*' --since '<since>' --no-pager 2>/dev/null | tail -20`

**Network**
- `journalctl -u NetworkManager wpa_supplicant --since '<since>' --no-pager 2>/dev/null | grep -iE 'error|fail|disconnect' | head -20`
- `ss -ltn | head` — listening sockets sanity

**Packaging health (Fedora-specific)**
- `sudo dnf check-update 2>&1 | tail -20` — pending updates
- `rpm -qa --queryformat '%{NAME}-%{VERSION}-%{RELEASE}\n' | awk -v cur="fc$(rpm -E '%fedora')" '$0 !~ cur && $0 ~ /fc[0-9]+/ {print}' | head -20` — packages from older Fedora releases (post-upgrade stragglers)
- `sudo dnf repolist --disabled 2>&1 | head` — disabled repos that may need re-enabling
- `sudo dnf list autoremove --quiet 2>&1 | wc -l` — orphan count
- `dnf history --reverse 2>&1 | head -5` — recent transactions
- `sudo dnf needs-restarting 2>&1 | tail -5` — services needing restart after update

**Performance / tuning candidates**
- `cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null` — CPU governor
- `nvidia-smi --query-gpu=power.management,persistence_mode --format=csv 2>/dev/null` — NVIDIA power mgmt
- `systemd-analyze 2>&1 | head -3` — boot time
- `systemd-analyze blame --no-pager 2>&1 | head -10` — slowest services
- `cat /proc/cmdline` — kernel boot params
- `sysctl vm.swappiness vm.vfs_cache_pressure 2>/dev/null` — memory tunables

### Sudo handling

If `sudo` requires a password and prompts interrupt the run, prefer `sudo -n` (non-interactive) for log queries; if it fails, fall back to user-readable equivalents (`journalctl` without -p, `dmesg` may need sudo on some systems, etc.). Note in the audit which checks were skipped due to sudo prompts.

## Phase 2 — Triage by severity

Categorize each finding:

- **SAFE (auto-fix)** — clearing user caches, rebuilding fontconfig / kbuildsycoca / icon caches, `fc-cache -fv`, restarting user services, fixing perms in `$HOME`, removing user-level orphan config files, switching user-level KDE settings via `kwriteconfig6`, fail2ban operations within an existing jail, `dnf autoremove` of obvious orphans (after dry-run inspection).
- **CAUTION (auto-fix, with brief justification in audit)** — reinstalling individual small user-facing packages (e.g. broken icon themes), enabling/disabling specific user-level systemd units, removing leftover packages from a prior Fedora release **only** if they have working fc-current replacements installed, refreshing the appstream cache.
- **RISKY (REQUIRES APPROVAL)** — kernel cmdline changes, removing or installing kernels, swapping graphics drivers, modifying `/etc/*` configs (sshd, sudoers, fstab, network), `dnf upgrade`, disabling system services (firewalld, sshd, NetworkManager, sddm, etc.), changing the bootloader / GRUB, filesystem operations beyond `df` (e.g., `fsck`, `resize2fs`, `btrfs balance`), modifying boot-time `sysctl` durably, anything that needs a reboot to validate.

If unsure, treat it as RISKY.

## Phase 3 — Write the audit document

Path: `~/.claude/audits/audit-YYYYMMDD-HHMMSS.md` (use the current local time).

Template:

```markdown
# System audit — YYYY-MM-DD HH:MM (window: <duration phrase>)

## Summary

<2–5 lines: what's healthy, what's concerning, top recurring symptom>

## Findings — auto-fix queue

### 1. <Title> — SAFE
**Evidence**: <≤2 lines: log excerpt, count, or command output>
**Plan**:
- [ ] <step 1 command or action>
- [ ] <step 2>
**Verify**: <one-line command to re-check after fix>

### 2. <Title> — CAUTION
...

## Findings — REQUIRES APPROVAL (deferred)

### A. <Title> — RISKY
**Evidence**: ...
**Plan**: ...
**Why risky**: <one line: what could break>
**Rollback**: <how to undo if it goes wrong>

### B. <Title> — RISKY
...

## Performance / tuning observations (non-actionable, informational)

- <bullets — e.g. "boot time 24s, mostly NetworkManager-wait-online (8s) — could mask this">
- <... only if genuinely useful>
```

Findings rules:
- Auto-fix queue: ordered cheapest-fastest first.
- Approval queue: ordered highest-impact first (so the user reads the important ones first).
- One finding per discrete issue. Don't bundle.
- Cite specific evidence — log line, command output, or count. Vague findings get cut.
- If no issues found: write a minimal doc with `## Summary` ("clean") and a tuning observations section only.

Cap the audit at **15 findings total** (10 auto-fix + 5 approval). If you find more, drop the lowest-value ones and note in summary that there were more.

## Phase 4 — Execute the auto-fix queue

For each item in the auto-fix queue, in order:

1. Read the current audit doc.
2. Run the planned commands.
3. Run the **Verify** command.
4. If verify passes: Edit the audit doc to flip each `- [ ]` → `- [x]` for that finding's steps, and append `**Result**: fixed` on a new line under the finding.
5. If verify fails: append `**Result**: failed — <one-line reason>` and **do not** flip the boxes. Continue with the next item.
6. Do not retry failed items automatically. Leave them for the user.

After the queue:
- Run `kbuildsycoca6 --noincremental 2>/dev/null` and `update-desktop-database ~/.local/share/applications 2>/dev/null` (cheap, often needed after any change).

## Phase 5 — Present the approval queue

After auto-fixes complete, summarize to the user:
- One short paragraph with the auto-fix tally (fixed N / failed M / skipped K).
- Then list the RISKY items as a numbered punch list: title + one-line consequence each.
- Use `AskUserQuestion` if there are 1–4 risky items (one question per item or one multi-select question). For more, ask via plain text which to proceed with.
- For each approved item, execute it, verify, and update the audit doc the same way.

Always tell the user the absolute path to the audit doc at the end.

## Hard rules — do not violate

- **Never** run `--no-verify`, `--force`, `--allowerasing`, or any flag that bypasses safety checks in the auto-fix phase. Those belong in the approval queue.
- **Never** auto-execute anything that touches:
  - `/etc/ssh/`, `/etc/sudoers*`, `/etc/fstab`, `/etc/default/grub`, `/etc/dnf/dnf.conf`
  - `/boot/`, `/efi/`
  - Kernel packages, NVIDIA / AMDGPU drivers, akmod / DKMS, the running kernel module set
  - Bootloader (`grub2-*`, `systemd-boot`)
  - Network services (`NetworkManager`, `firewalld`, `wpa_supplicant`, `sshd`)
  - Display manager (`sddm`, `gdm`)
- **Never** kill long-running user processes (browser, IDE, dev server, editor, IRC client) as part of cleanup. If memory pressure is severe, list the hogs in the audit and ask.
- **Never** disable a system service unless explicitly approved by the user, even if it's failing.
- **Never** run `dnf upgrade` or `dnf install` of >5 packages in auto-fix. That's an approval item.
- **Never** modify the user's icon theme, GTK theme, cursor, or fonts in auto-fix — those are visible UX changes. They go in the approval queue (e.g., "your icon theme has broken SVGs causing Discover to crash; switch to breeze-dark?").

## Known Fedora post-upgrade patterns to look for

(Fast-pattern-recognition checklist — these recur across Fedora major-version upgrades.)

- `*.fcNN.x86_64` packages from a previous Fedora release still installed (post-upgrade stragglers).
- `*-debuginfo` or `*-debugsource` orphans bloating disk.
- Stale icon / kbuildsycoca caches causing KDE app crashes.
- Old GPG keys with broken `signing-capable` flags poisoning all rpm/dnf calls (recent issue with Zoom and a few other vendors' keys).
- Versionlock'd kernels from a previous release.
- Disabled third-party repos still referenced by `.repo` files (cuda, microsoft, vscode, signal, brave).
- `kmod-*-latest-dkms` packages from cuda-style repos failing to build against a new kernel because the upstream driver doesn't yet support the new kernel's API.
- `akmod-*` not rebuilt for the running kernel (check `/lib/modules/$(uname -r)/extra/`).
- Custom icon themes containing `<text>` elements in SVGs that crash Qt6+freetype 2.14+ (F44+).
- Mismatched fc-tag in `/var/log/dnf5.log` showing the upgrade left orphan transactions.
- `firewalld` complaining about deprecated zones or policies after a major version bump.

If any of these patterns hit, surface them with the specific evidence line. Don't paste generic "post-upgrade cleanup recommended" boilerplate.

## Output

Final response to user: 5–10 lines.
- One sentence summary.
- Auto-fix tally (e.g., "Fixed 6, failed 1 — see audit").
- Risky items count + ask which to proceed with (if any).
- Path to the audit doc.

Don't print the full audit content inline — the user can open the file.

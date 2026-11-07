#!/bin/bash
# Claude Code Status Line
# Based on https://github.com/daniel3303/ClaudeCodeStatusLine
# Enhanced: git branch/ahead-behind, token bar, caching, improved visuals

set -f  # disable globbing

# ===== Config =====
SHOW_GIT=true           # git branch, dirty status, ahead/behind
SHOW_TOKENS=true        # token usage bar
SHOW_THINKING=false     # extended thinking indicator
SHOW_ORG=true           # organization name (takes the middle slot when thinking is off)
SHOW_COST=false         # session API cost (wide/full tiers only)
SHOW_RATE_LIMITS=true   # 5h / 7d rate limit bars
SHOW_EXTRA_USAGE=false  # extra/overage credits bar ($used/$limit)
BRANCH_MAX_LEN=28       # truncate branch names longer than this
GIT_CACHE_SECS=10       # seconds to cache git status (git diff is slow on large repos)
TOKEN_BAR_WIDTH=8       # width of token progress bar
API_CACHE_SECS=60       # seconds to cache rate-limit API responses
RATE_LIMIT_BAR_WIDTH=6  # width of rate-limit progress bars

# Terminal width detection.
# Claude Code runs this script in a subprocess — COLUMNS is 0 and tput/stty
# may not see the real TTY. When detection fails we default to 80 (safe/compact)
# rather than wide, so the line never wraps.
#
# To show more on a wider terminal, set TERM_WIDTH in settings.json:
#   "command": "TERM_WIDTH=160 ~/.claude/statusline.sh"
if [ "${TERM_WIDTH:-0}" -le 0 ] 2>/dev/null; then
    if [ "${COLUMNS:-0}" -gt 0 ] 2>/dev/null; then
        TERM_WIDTH=$COLUMNS
    else
        _w=$(stty size </dev/tty 2>/dev/null | awk '{print $2}')
        [ "${_w:-0}" -gt 0 ] 2>/dev/null && TERM_WIDTH=$_w || TERM_WIDTH=80
        unset _w
    fi
fi

input=$(cat)
[ -z "$input" ] && printf "Claude" && exit 0

mkdir -p /tmp/claude

# ===== Colors =====
blue='\033[38;2;97;175;239m'
orange='\033[38;2;255;176;85m'
amber='\033[38;2;229;192;123m'
green='\033[38;2;80;200;120m'
cyan='\033[38;2;86;182;194m'
red='\033[38;2;235;87;87m'
yellow='\033[38;2;230;200;0m'
white='\033[38;2;220;220;220m'
magenta='\033[38;2;198;120;221m'
dim='\033[2m'
reset='\033[0m'

sep=" ${dim}│${reset} "

# ===== Helpers =====

format_tokens() {
    local num=$1
    if [ "$num" -ge 1000000 ]; then
        awk "BEGIN {printf \"%.1fm\", $num / 1000000}"
    elif [ "$num" -ge 1000 ]; then
        awk "BEGIN {printf \"%.0fk\", $num / 1000}"
    else
        printf "%d" "$num"
    fi
}

truncate_str() {
    local str="$1" max="$2"
    [ "${#str}" -gt "$max" ] \
        && printf "%s…" "${str:0:$((max-1))}" \
        || printf "%s" "$str"
}

# Colored progress bar using block chars
build_bar() {
    local pct=$1 width=$2
    [ "$pct" -lt 0 ] 2>/dev/null && pct=0
    [ "$pct" -gt 100 ] 2>/dev/null && pct=100
    local filled=$(( pct * width / 100 ))
    local empty=$(( width - filled ))
    local bar_color
    if   [ "$pct" -ge 90 ]; then bar_color="$red"
    elif [ "$pct" -ge 70 ]; then bar_color="$yellow"
    elif [ "$pct" -ge 50 ]; then bar_color="$orange"
    else                         bar_color="$green"
    fi
    local f="" e=""
    for ((i=0; i<filled; i++)); do f+="█"; done
    for ((i=0; i<empty;  i++)); do e+="░"; done
    printf "${bar_color}${f}${dim}${e}${reset}"
}

# ===== Git info with per-directory caching =====
get_git_info() {
    local dir="$1"
    [ -z "$dir" ] && return

    # Stable cache key per directory path
    local dir_hash
    dir_hash=$(printf '%s' "$dir" | cksum | awk '{print $1}')
    local cache_file="/tmp/claude/git-${dir_hash}"

    local needs_refresh=true
    if [ -f "$cache_file" ]; then
        local mtime now age
        mtime=$(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null)
        now=$(date +%s)
        age=$(( now - mtime ))
        [ "$age" -lt "$GIT_CACHE_SECS" ] && needs_refresh=false
    fi

    if $needs_refresh; then
        # Branch name (or short hash for detached HEAD)
        local branch
        branch=$(git -C "$dir" symbolic-ref --short HEAD 2>/dev/null)
        if [ -z "$branch" ]; then
            branch=$(git -C "$dir" rev-parse --short HEAD 2>/dev/null)
            if [ -z "$branch" ]; then
                : > "$cache_file"   # not a git repo — write empty cache
                return
            fi
            branch="(${branch})"
        fi

        # Dirty: any staged or unstaged changes
        local dirty=""
        [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ] && dirty="dirty"

        # Ahead / behind upstream (skip if no upstream set)
        local ahead=0 behind=0
        local upstream
        upstream=$(git -C "$dir" rev-parse --abbrev-ref "@{upstream}" 2>/dev/null)
        if [ -n "$upstream" ]; then
            local ab
            ab=$(git -C "$dir" rev-list --left-right --count "HEAD...${upstream}" 2>/dev/null)
            ahead=$(echo "$ab"  | awk '{print $1}')
            behind=$(echo "$ab" | awk '{print $2}')
        fi

        # Tab-delimited cache (branch names can't contain tabs per git spec)
        printf '%s\t%s\t%s\t%s' "$branch" "$dirty" "${ahead:-0}" "${behind:-0}" > "$cache_file"
    fi

    cat "$cache_file" 2>/dev/null
}

# ===== OAuth token resolution =====
get_oauth_token() {
    [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ] && echo "$CLAUDE_CODE_OAUTH_TOKEN" && return 0

    if command -v security >/dev/null 2>&1; then
        local blob token
        blob=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
        if [ -n "$blob" ]; then
            token=$(echo "$blob" | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)
            [ -n "$token" ] && [ "$token" != "null" ] && echo "$token" && return 0
        fi
    fi

    # Honor CLAUDE_CONFIG_DIR — each running agent passes this through to
    # subprocesses, so the statusline picks up the correct account's token
    # when multiple orgs/configs run side-by-side (.claude / .claude-work / etc).
    # Try the active config dir first, then plain ~/.claude as a fallback.
    local _cfg
    for _cfg in "${CLAUDE_CONFIG_DIR:-}" "$HOME/.claude"; do
        [ -z "$_cfg" ] && continue
        local creds_file="${_cfg}/.credentials.json"
        if [ -f "$creds_file" ]; then
            local token
            token=$(jq -r '.claudeAiOauth.accessToken // empty' "$creds_file" 2>/dev/null)
            [ -n "$token" ] && [ "$token" != "null" ] && echo "$token" && return 0
        fi
    done

    if command -v secret-tool >/dev/null 2>&1; then
        local blob token
        blob=$(timeout 2 secret-tool lookup service "Claude Code-credentials" 2>/dev/null)
        if [ -n "$blob" ]; then
            token=$(echo "$blob" | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)
            [ -n "$token" ] && [ "$token" != "null" ] && echo "$token" && return 0
        fi
    fi

    echo ""
}

# ===== ISO 8601 → epoch (cross-platform) =====
iso_to_epoch() {
    local iso_str="$1"
    local epoch

    epoch=$(date -d "${iso_str}" +%s 2>/dev/null)
    [ -n "$epoch" ] && echo "$epoch" && return 0

    local stripped="${iso_str%%.*}"
    stripped="${stripped%%Z}"
    stripped="${stripped%%+*}"
    stripped="${stripped%%-[0-9][0-9]:[0-9][0-9]}"

    if [[ "$iso_str" == *"Z"* ]] || [[ "$iso_str" == *"+00:00"* ]] || [[ "$iso_str" == *"-00:00"* ]]; then
        epoch=$(env TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "$stripped" +%s 2>/dev/null)
    else
        epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "$stripped" +%s 2>/dev/null)
    fi

    [ -n "$epoch" ] && echo "$epoch" && return 0
    return 1
}

format_remaining_time() {
    local iso_str="$1"
    [ -z "$iso_str" ] || [ "$iso_str" = "null" ] && return
    local epoch now diff
    epoch=$(iso_to_epoch "$iso_str")
    [ -z "$epoch" ] && return
    now=$(date +%s)
    diff=$(( epoch - now ))
    [ "$diff" -le 0 ] && echo "now" && return
    if [ "$diff" -lt 60 ]; then
        echo "${diff}s"
    elif [ "$diff" -lt 3600 ]; then
        echo "$(( diff / 60 ))m"
    elif [ "$diff" -lt 86400 ]; then
        local h=$(( diff / 3600 ))
        local m=$(( (diff % 3600) / 60 ))
        [ "$m" -gt 0 ] && echo "${h}h${m}m" || echo "${h}h"
    else
        local d=$(( diff / 86400 ))
        local h=$(( (diff % 86400) / 3600 ))
        [ "$h" -gt 0 ] && echo "${d}d${h}h" || echo "${d}d"
    fi
}

format_reset_time() {
    local iso_str="$1" style="$2"
    [ -z "$iso_str" ] || [ "$iso_str" = "null" ] && return
    local epoch
    epoch=$(iso_to_epoch "$iso_str")
    [ -z "$epoch" ] && return
    case "$style" in
        time)
            date -j -r "$epoch" +"%l:%M%p" 2>/dev/null | sed 's/^ //' | tr '[:upper:]' '[:lower:]' ||
            date -d "@$epoch"   +"%l:%M%P"  2>/dev/null | sed 's/^ //'
            ;;
        datetime)
            date -j -r "$epoch" +"%b %-d, %l:%M%p" 2>/dev/null | sed 's/  / /g; s/^ //' | tr '[:upper:]' '[:lower:]' ||
            date -d "@$epoch"   +"%b %-d, %l:%M%P"  2>/dev/null | sed 's/  / /g; s/^ //'
            ;;
    esac
}

# ===== Extract JSON =====
model_name=$(echo "$input" | jq -r '.model.display_name // "Claude"')
cwd=$(echo "$input"        | jq -r '.cwd // empty')
cost_usd=$(echo "$input"   | jq -r '.cost.total_cost_usd // empty')
effort_level=$(echo "$input" | jq -r '.effort.level // empty')

size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
[ "$size" -eq 0 ] 2>/dev/null && size=200000

input_tokens=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
cache_create=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
cache_read=$(echo "$input"   | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')
current=$(( input_tokens + cache_create + cache_read ))

used_tokens=$(format_tokens $current)
total_tokens=$(format_tokens $size)
pct_used=$(( size > 0 ? current * 100 / size : 0 ))

thinking_on=false
settings_path="$HOME/.claude/settings.json"
if [ -f "$settings_path" ]; then
    thinking_val=$(jq -r '.alwaysThinkingEnabled // false' "$settings_path" 2>/dev/null)
    [ "$thinking_val" = "true" ] && thinking_on=true
fi

# Organization name — read from the active config dir's .claude.json
org_name=""
if $SHOW_ORG; then
    for _cfg in \
        "${CLAUDE_CONFIG_DIR:-}/.claude.json" \
        "$HOME/.claude.json"
    do
        if [ -n "$_cfg" ] && [ -f "$_cfg" ]; then
            org_name=$(jq -r '.oauthAccount.organizationName // ""' "$_cfg" 2>/dev/null)
            [ -n "$org_name" ] && break
        fi
    done
    unset _cfg
fi

# ===== Adaptive width tiers =====
#
# Tiers (tuned so each tier's max output fits within its min width):
#
#  full    (≥150): CWD, ahead/behind, "◆ thinking", 5h+7d+reset, cost
#  wide    (100–149): ahead/behind, "◆ thinking", 5h+reset, cost
#  split   (70–99):  ahead/behind, "◆" symbol, 5h bar, cost
#  narrow  (<70):  short model + branch + token only
#
if   [ "$TERM_WIDTH" -ge 150 ] 2>/dev/null; then width_tier="full"
elif [ "$TERM_WIDTH" -ge 100 ] 2>/dev/null; then width_tier="wide"
elif [ "$TERM_WIDTH" -ge 76  ] 2>/dev/null; then width_tier="split"
else                                              width_tier="narrow"
fi

# Shorten model name for tight spaces
short_model() {
    case "$1" in
        *Opus*)   echo "Opus" ;;
        *Sonnet*) echo "Sonnet" ;;
        *Haiku*)  echo "Haiku" ;;
        *)        echo "$1" | awk '{print $NF}' ;;   # last word
    esac
}

# ===== Build output =====
out=""

# Model — color by family
model_color="$orange"
case "$model_name" in
    *Opus*)  model_color="$cyan" ;;
    *Haiku*) model_color="$amber"  ;;
esac

display_model="$model_name"
[ "$width_tier" = "narrow" ] && display_model=$(short_model "$model_name")
out+="${model_color}${display_model}${reset}"

# Effort level — column right after the model name, color-coded by intensity
# (dim → green → amber → orange → red). Sourced from .effort.level in the
# statusline JSON (values: low / medium / high / xhigh / max).
if [ -n "$effort_level" ]; then
    case "$effort_level" in
        low)    effort_color="$dim"    ;;
        medium) effort_color="$green"  ;;
        high)   effort_color="$amber"  ;;
        xhigh)  effort_color="$orange" ;;
        max)    effort_color="$red"    ;;
        *)      effort_color="$cyan"   ;;
    esac
    if [ "$width_tier" = "narrow" ]; then
        out+="${sep}${effort_color}⚡${effort_level}${reset}"
    else
        out+="${sep}${effort_color}⚡ ${effort_level}${reset}"
    fi
fi

# Git branch + dirty + ahead/behind
if $SHOW_GIT && [ -n "$cwd" ]; then
    git_info=$(get_git_info "$cwd")
    if [ -n "$git_info" ]; then
        IFS=$'\t' read -r g_branch g_dirty g_ahead g_behind <<< "$git_info"

        # Progressively tighten branch truncation
        local_max="$BRANCH_MAX_LEN"
        [ "$width_tier" = "wide"   ] && local_max=24
        [ "$width_tier" = "split"  ] && local_max=18
        [ "$width_tier" = "narrow" ] && local_max=12
        g_branch_display=$(truncate_str "$g_branch" "$local_max")

        out+="${sep}${dim}⎇${reset} ${magenta}${g_branch_display}${reset}"

        if [ "$g_dirty" = "dirty" ]; then
            out+=" ${red}✗${reset}"
        else
            out+=" ${green}✔${reset}"
        fi

        # Ahead/behind: shown in all tiers except narrow (only if non-zero)
        if [ "$width_tier" != "narrow" ]; then
            [ "${g_ahead:-0}"  -gt 0 ] && out+=" ${green}↑${g_ahead}${reset}"
            [ "${g_behind:-0}" -gt 0 ] && out+=" ${orange}↓${g_behind}${reset}"
        fi
    fi
fi

# Token bar
if $SHOW_TOKENS; then
    bar_w="$TOKEN_BAR_WIDTH"
    [ "$width_tier" = "wide"   ] && bar_w=6
    [ "$width_tier" = "split"  ] && bar_w=5
    [ "$width_tier" = "narrow" ] && bar_w=4
    token_bar=$(build_bar "$pct_used" "$bar_w")
    out+="${sep}${token_bar} ${orange}${used_tokens}${dim}/${reset}${white}${total_tokens}${reset} ${dim}${pct_used}%${reset}"
fi

# Middle slot: Organization (preferred) or Thinking indicator.
# SHOW_ORG + SHOW_THINKING are independent; org wins when both are on.
#   full/wide  → "⬡ Vendidit"  or  "◆ thinking" / "◇ thinking"
#   split      → "Vendidit"    or  "◆" / "◇"                  (saves space)
#   narrow     → hidden
if $SHOW_ORG && [ -n "$org_name" ] && [ "$width_tier" != "narrow" ]; then
    if [ "$width_tier" = "split" ]; then
        out+="${sep}${magenta}${org_name}${reset}"
    else
        out+="${sep}${magenta}⬡ ${org_name}${reset}"
    fi
elif $SHOW_THINKING && [ "$width_tier" != "narrow" ]; then
    out+="${sep}"
    if $thinking_on; then
        if [ "$width_tier" = "split" ]; then out+="${amber}◆${reset}"
        else out+="${amber}◆ thinking${reset}"; fi
    else
        if [ "$width_tier" = "split" ]; then out+="${dim}◇${reset}"
        else out+="${dim}◇ thinking${reset}"; fi
    fi
fi

# Session cost — wide/full only
if $SHOW_COST && [ -n "$cost_usd" ] && [ "$width_tier" = "wide" -o "$width_tier" = "full" ]; then
    cost_fmt=$(printf '%.2f' "$cost_usd" 2>/dev/null)
    [ -n "$cost_fmt" ] && out+="${sep}${dim}\$${cost_fmt}${reset}"
fi

# ===== Rate limits (API, cached 60s) =====
# shown in full/wide/split; hidden only in narrow
if $SHOW_RATE_LIMITS && [ "$width_tier" != "narrow" ]; then
    # Fetch token first so the cache key is account-specific.
    # Switching accounts automatically invalidates the old cache.
    token=$(get_oauth_token)
    usage_data=""

    if [ -n "$token" ] && [ "$token" != "null" ]; then
        token_hash=$(printf '%s' "$token" | cksum | awk '{print $1}')
        api_cache="/tmp/claude/statusline-usage-${token_hash}.json"
        needs_refresh=true

        if [ -f "$api_cache" ]; then
            cache_mtime=$(stat -c %Y "$api_cache" 2>/dev/null || stat -f %m "$api_cache" 2>/dev/null)
            now=$(date +%s)
            cache_age=$(( now - cache_mtime ))
            if [ "$cache_age" -lt "$API_CACHE_SECS" ]; then
                cached_content=$(cat "$api_cache" 2>/dev/null)
                if [ -n "$cached_content" ] && ! echo "$cached_content" | jq -e '.error' >/dev/null 2>&1; then
                    needs_refresh=false
                    usage_data="$cached_content"
                fi
            fi
        fi

        if $needs_refresh; then
            response=$(curl -s --max-time 10 \
                -H "Accept: application/json" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -H "anthropic-beta: oauth-2025-04-20" \
                -H "User-Agent: claude-code/2.1.34" \
                "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)
            if [ -n "$response" ] && echo "$response" | jq . >/dev/null 2>&1; then
                if ! echo "$response" | jq -e '.error' >/dev/null 2>&1; then
                    usage_data="$response"
                    echo "$response" > "$api_cache"
                fi
            fi
            # Fall back to stale cache if refresh failed
            if [ -z "$usage_data" ] && [ -f "$api_cache" ]; then
                stale=$(cat "$api_cache" 2>/dev/null)
                ! echo "$stale" | jq -e '.error' >/dev/null 2>&1 && usage_data="$stale"
            fi
        fi
    fi

    if [ -n "$usage_data" ] && echo "$usage_data" | jq -e . >/dev/null 2>&1; then
        bar_width=$RATE_LIMIT_BAR_WIDTH
        [ "$width_tier" = "split" ] && bar_width=$(( RATE_LIMIT_BAR_WIDTH - 2 ))

        five_hour_pct=$(echo "$usage_data"       | jq -r '.five_hour.utilization // 0' | awk '{printf "%.0f", $1}')
        five_hour_reset_iso=$(echo "$usage_data" | jq -r '.five_hour.resets_at // empty')
        five_hour_bar=$(build_bar "$five_hour_pct" "$bar_width")
        five_hour_remaining=$(format_remaining_time "$five_hour_reset_iso")
        five_hour_label="${five_hour_remaining:-5h}"
        out+="${sep}${dim}${five_hour_label}${reset} ${five_hour_bar} ${cyan}${five_hour_pct}%${reset}"
        # Reset time: full and wide only (not split — saves ~12 chars)
        if [ "$width_tier" = "full" ] || [ "$width_tier" = "wide" ]; then
            five_hour_reset=$(format_reset_time "$five_hour_reset_iso" "time")
            [ -n "$five_hour_reset" ] && out+=" ${dim}↺ ${five_hour_reset}${reset}"
        fi

        # 7d bar + reset: full only
        if [ "$width_tier" = "full" ]; then
            seven_day_pct=$(echo "$usage_data"       | jq -r '.seven_day.utilization // 0' | awk '{printf "%.0f", $1}')
            seven_day_reset_iso=$(echo "$usage_data" | jq -r '.seven_day.resets_at // empty')
            seven_day_reset=$(format_reset_time "$seven_day_reset_iso" "datetime")
            seven_day_bar=$(build_bar "$seven_day_pct" "$bar_width")
            seven_day_remaining=$(format_remaining_time "$seven_day_reset_iso")
            seven_day_label="${seven_day_remaining:-7d}"
            out+="${sep}${dim}${seven_day_label}${reset} ${seven_day_bar} ${cyan}${seven_day_pct}%${reset}"
            [ -n "$seven_day_reset" ] && out+=" ${dim}↺ ${seven_day_reset}${reset}"

            extra_enabled=$(echo "$usage_data" | jq -r '.extra_usage.is_enabled // false')
            if $SHOW_EXTRA_USAGE && [ "$extra_enabled" = "true" ]; then
                extra_pct=$(echo "$usage_data"   | jq -r '.extra_usage.utilization // 0'   | awk '{printf "%.0f", $1}')
                extra_used=$(echo "$usage_data"  | jq -r '.extra_usage.used_credits // 0'  | awk '{printf "%.2f", $1/100}')
                extra_limit=$(echo "$usage_data" | jq -r '.extra_usage.monthly_limit // 0' | awk '{printf "%.2f", $1/100}')
                extra_bar=$(build_bar "$extra_pct" "$bar_width")
                out+="${sep}${dim}extra${reset} ${extra_bar} ${cyan}\$${extra_used}${dim}/\$${extra_limit}${reset}"
            fi
        fi
    fi
fi

# CWD — full path with ~ abbreviation, appended at end of status line
if [ -n "$cwd" ]; then
    display_cwd="${cwd/#$HOME/~}"
    out+="${sep}${dim}${display_cwd}${reset}"
fi

printf "%b" "$out"
exit 0
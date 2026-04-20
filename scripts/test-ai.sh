#!/bin/bash
# =============================================================================
# IranENovin AI Backend Test Script
# Tests all AI backends: Codex CLI, OpenAI OAuth, Anthropic Claude
# Usage: bash scripts/test-ai.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}  PASS${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  FAIL${NC} $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "${YELLOW}  WARN${NC} $1"; WARN=$((WARN+1)); }
info() { echo -e "${BLUE}  INFO${NC} $1"; }

echo ""
echo "============================================="
echo "  IranENovin AI Backend Diagnostics"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# Test 1: Codex CLI Installation
# ---------------------------------------------------------------------------
echo "--- Test 1: Codex CLI Installation ---"

if command -v codex &>/dev/null; then
  CODEX_PATH=$(which codex)
  pass "codex found at: $CODEX_PATH"

  CODEX_VERSION=$(codex --version 2>&1 || true)
  info "Version: $CODEX_VERSION"
else
  fail "codex CLI not found in PATH"
  info "Install: npm install -g @openai/codex"
  info "Or: brew install codex (if available)"
fi

echo ""

# ---------------------------------------------------------------------------
# Test 2: Codex Auth File
# ---------------------------------------------------------------------------
echo "--- Test 2: Codex Auth File ---"

AUTH_FILE="$HOME/.codex/auth.json"
if [ -f "$AUTH_FILE" ]; then
  pass "Auth file exists at $AUTH_FILE"

  # Check auth_mode
  AUTH_MODE=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print(d.get('auth_mode','unknown'))" 2>/dev/null || echo "unknown")
  info "Auth mode: $AUTH_MODE"

  # Check if tokens exist
  HAS_ACCESS=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print('yes' if d.get('tokens',{}).get('access_token') else 'no')" 2>/dev/null || echo "unknown")
  HAS_REFRESH=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print('yes' if d.get('tokens',{}).get('refresh_token') else 'no')" 2>/dev/null || echo "unknown")
  HAS_ID=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print('yes' if d.get('tokens',{}).get('id_token') else 'no')" 2>/dev/null || echo "unknown")

  [ "$HAS_ACCESS" = "yes" ] && pass "access_token present" || fail "access_token missing"
  [ "$HAS_REFRESH" = "yes" ] && pass "refresh_token present" || fail "refresh_token missing"
  [ "$HAS_ID" = "yes" ] && pass "id_token present" || warn "id_token missing (may be ok)"

  # Check last_refresh
  LAST_REFRESH=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print(d.get('last_refresh','unknown'))" 2>/dev/null || echo "unknown")
  info "Last refresh: $LAST_REFRESH"
else
  fail "Auth file NOT found at $AUTH_FILE"
  info "Run: codex auth login"
fi

echo ""

# ---------------------------------------------------------------------------
# Test 3: JWT Token Expiry Analysis
# ---------------------------------------------------------------------------
echo "--- Test 3: JWT Token Expiry ---"

if [ -f "$AUTH_FILE" ]; then
  # Decode JWT access_token exp claim
  # JWT format: header.payload.signature -- we decode the payload (middle part)
  ACCESS_TOKEN=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print(d.get('tokens',{}).get('access_token',''))" 2>/dev/null || echo "")

  if [ -n "$ACCESS_TOKEN" ]; then
    # Extract and decode JWT payload
    ACCESS_EXP=$(python3 -c "
import json, base64, sys
token = '$ACCESS_TOKEN'
parts = token.split('.')
if len(parts) >= 2:
    # Add padding
    payload = parts[1] + '=' * (4 - len(parts[1]) % 4)
    decoded = base64.urlsafe_b64decode(payload)
    data = json.loads(decoded)
    exp = data.get('exp', 0)
    print(exp)
else:
    print(0)
" 2>/dev/null || echo "0")

    if [ "$ACCESS_EXP" != "0" ]; then
      NOW=$(python3 -c "import time; print(int(time.time()))")
      DIFF=$((ACCESS_EXP - NOW))

      if [ "$DIFF" -gt 0 ]; then
        HOURS=$((DIFF / 3600))
        MINS=$(( (DIFF % 3600) / 60 ))
        pass "access_token valid for ${HOURS}h ${MINS}m"

        # Decode expiry as human-readable date
        EXP_DATE=$(python3 -c "from datetime import datetime, timezone; print(datetime.fromtimestamp($ACCESS_EXP, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'))")
        info "access_token expires: $EXP_DATE"
      else
        ABS_DIFF=$(( -DIFF ))
        HOURS=$((ABS_DIFF / 3600))
        fail "access_token EXPIRED ${HOURS}h ago"
        info "Run: codex auth login   (to get a new token)"
      fi
    else
      warn "Could not decode access_token expiry"
    fi

    # Also check the ChatGPT subscription info from id_token
    ID_TOKEN=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print(d.get('tokens',{}).get('id_token',''))" 2>/dev/null || echo "")

    if [ -n "$ID_TOKEN" ]; then
      SUB_INFO=$(python3 -c "
import json, base64
token = '$ID_TOKEN'
parts = token.split('.')
if len(parts) >= 2:
    payload = parts[1] + '=' * (4 - len(parts[1]) % 4)
    decoded = base64.urlsafe_b64decode(payload)
    data = json.loads(decoded)
    auth = data.get('https://api.openai.com/auth', {})
    plan = auth.get('chatgpt_plan_type', 'unknown')
    until = auth.get('chatgpt_subscription_active_until', 'unknown')
    exp = data.get('exp', 0)
    print(f'plan={plan}|until={until}|exp={exp}')
" 2>/dev/null || echo "plan=unknown|until=unknown|exp=0")

      PLAN=$(echo "$SUB_INFO" | cut -d'|' -f1 | cut -d= -f2)
      UNTIL=$(echo "$SUB_INFO" | cut -d'|' -f2 | cut -d= -f2)
      ID_EXP=$(echo "$SUB_INFO" | cut -d'|' -f3 | cut -d= -f2)

      info "ChatGPT plan: $PLAN"
      info "Subscription active until: $UNTIL"

      # id_token has short expiry (1 hour) -- this is normal
      if [ "$ID_EXP" != "0" ]; then
        ID_DIFF=$((ID_EXP - NOW))
        if [ "$ID_DIFF" -gt 0 ]; then
          pass "id_token still valid (${ID_DIFF}s remaining)"
        else
          warn "id_token expired (this is normal -- it's short-lived, only access_token matters for API calls)"
        fi
      fi
    fi
  fi
fi

echo ""

# ---------------------------------------------------------------------------
# Test 4: Codex CLI Simple Call
# ---------------------------------------------------------------------------
echo "--- Test 4: Codex CLI Simple Call ---"

if command -v codex &>/dev/null; then
  info "Attempting: codex exec -m gpt-4.1 'Say hello in one word'"

  CODEX_OUTPUT=$(timeout 60 codex exec -m gpt-4.1 'Say hello in one word' 2>&1) && CODEX_RC=$? || CODEX_RC=$?

  if [ $CODEX_RC -eq 0 ] && [ -n "$CODEX_OUTPUT" ]; then
    pass "Codex CLI call succeeded"
    # Show first 5 lines of output
    echo "$CODEX_OUTPUT" | head -10 | while IFS= read -r line; do
      info "  > $line"
    done
  else
    fail "Codex CLI call failed (exit code: $CODEX_RC)"
    echo "$CODEX_OUTPUT" | head -10 | while IFS= read -r line; do
      info "  > $line"
    done
    echo ""
    info "Common causes:"
    info "  1. Token expired -- run: codex auth login"
    info "  2. Model not available -- try: codex exec -m gpt-4.1 (not gpt-5.4)"
    info "  3. Network issue"
    info "  4. ChatGPT Plus subscription expired"
  fi
else
  warn "Skipped (codex not installed)"
fi

echo ""

# ---------------------------------------------------------------------------
# Test 5: OpenAI OAuth API (direct, without codex CLI)
# ---------------------------------------------------------------------------
echo "--- Test 5: OpenAI OAuth API (direct) ---"

if [ -f "$AUTH_FILE" ]; then
  ACCESS_TOKEN=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print(d.get('tokens',{}).get('access_token',''))" 2>/dev/null || echo "")

  if [ -n "$ACCESS_TOKEN" ]; then
    info "Testing direct OpenAI API with OAuth token..."

    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST "https://api.openai.com/v1/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "model": "gpt-4.1",
        "max_tokens": 20,
        "messages": [{"role":"user","content":"Say hello in one word"}]
      }' 2>&1)

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
      pass "OpenAI OAuth API call succeeded (HTTP 200)"
      CONTENT=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['choices'][0]['message']['content'])" 2>/dev/null || echo "(parse error)")
      info "Response: $CONTENT"
    else
      fail "OpenAI OAuth API failed (HTTP $HTTP_CODE)"
      ERROR_MSG=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',{}).get('message','unknown'))" 2>/dev/null || echo "$BODY" | head -3)
      info "Error: $ERROR_MSG"

      if [ "$HTTP_CODE" = "401" ]; then
        info "Token is invalid/expired. Run: codex auth login"
      elif [ "$HTTP_CODE" = "429" ]; then
        info "Rate limited. Wait a moment and retry."
      fi
    fi
  else
    warn "No access_token to test with"
  fi
else
  warn "Skipped (no auth file)"
fi

echo ""

# ---------------------------------------------------------------------------
# Test 6: Token Refresh
# ---------------------------------------------------------------------------
echo "--- Test 6: OAuth Token Refresh ---"

if [ -f "$AUTH_FILE" ]; then
  REFRESH_TOKEN=$(python3 -c "import json; d=json.load(open('$AUTH_FILE')); print(d.get('tokens',{}).get('refresh_token',''))" 2>/dev/null || echo "")

  if [ -n "$REFRESH_TOKEN" ]; then
    info "Testing OAuth token refresh..."

    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST "https://auth0.openai.com/oauth/token" \
      -H "Content-Type: application/json" \
      -d "{
        \"grant_type\": \"refresh_token\",
        \"client_id\": \"DRivsnm2Mu42T3KOpqdtwB3NYviHYzwD\",
        \"refresh_token\": \"$REFRESH_TOKEN\"
      }" 2>&1)

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
      pass "Token refresh succeeded"
      info "New tokens received from auth0.openai.com"

      # Ask user before saving
      echo ""
      echo -e "${YELLOW}  Do you want to save the refreshed tokens to $AUTH_FILE? (y/N)${NC}"
      read -r SAVE_CHOICE

      if [ "$SAVE_CHOICE" = "y" ] || [ "$SAVE_CHOICE" = "Y" ]; then
        python3 -c "
import json, sys
new_tokens = json.loads('''$BODY''')
with open('$AUTH_FILE', 'r') as f:
    auth = json.load(f)
auth['tokens']['access_token'] = new_tokens['access_token']
if 'refresh_token' in new_tokens:
    auth['tokens']['refresh_token'] = new_tokens['refresh_token']
if 'id_token' in new_tokens:
    auth['tokens']['id_token'] = new_tokens['id_token']
from datetime import datetime, timezone
auth['last_refresh'] = datetime.now(timezone.utc).isoformat()
with open('$AUTH_FILE', 'w') as f:
    json.dump(auth, f, indent=2)
print('Saved!')
" 2>&1 && pass "Tokens saved to $AUTH_FILE" || fail "Failed to save tokens"
      else
        info "Skipped saving (tokens not written)"
      fi
    else
      fail "Token refresh failed (HTTP $HTTP_CODE)"
      ERROR_MSG=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error_description', d.get('error','unknown')))" 2>/dev/null || echo "$BODY" | head -3)
      info "Error: $ERROR_MSG"
      info ""
      info "If refresh_token is expired/revoked, you must re-login:"
      info "  codex auth login"
    fi
  else
    warn "No refresh_token available"
  fi
else
  warn "Skipped (no auth file)"
fi

echo ""

# ---------------------------------------------------------------------------
# Test 7: Anthropic Claude API
# ---------------------------------------------------------------------------
echo "--- Test 7: Anthropic Claude API ---"

# Try to read from .env.local
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"

ANTHROPIC_KEY=""
if [ -f "$ENV_FILE" ]; then
  ANTHROPIC_KEY=$(grep '^ANTHROPIC_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi

# Also check env var
if [ -z "$ANTHROPIC_KEY" ]; then
  ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"
fi

if [ -n "$ANTHROPIC_KEY" ]; then
  info "Testing Anthropic Claude API..."

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "https://api.anthropic.com/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $ANTHROPIC_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -d '{
      "model": "claude-sonnet-4-20250514",
      "max_tokens": 30,
      "messages": [{"role":"user","content":"Say hello in one word"}]
    }' 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    pass "Anthropic Claude API succeeded (HTTP 200)"
    CONTENT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['content'][0]['text'])" 2>/dev/null || echo "(parse error)")
    info "Response: $CONTENT"
  else
    fail "Anthropic Claude API failed (HTTP $HTTP_CODE)"
    ERROR_MSG=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',{}).get('message','unknown'))" 2>/dev/null || echo "$BODY" | head -3)
    info "Error: $ERROR_MSG"
  fi
else
  warn "ANTHROPIC_API_KEY not found (checked .env.local and env)"
  info "Set ANTHROPIC_API_KEY in .env.local or export it"
fi

echo ""

# ---------------------------------------------------------------------------
# Test 8: AI Config Check
# ---------------------------------------------------------------------------
echo "--- Test 8: AI Config ---"

AI_CONFIG="$PROJECT_DIR/_config/ai.json"
if [ -f "$AI_CONFIG" ]; then
  pass "ai.json found"

  DEFAULT_MODEL=$(python3 -c "import json; d=json.load(open('$AI_CONFIG')); print(d.get('defaultModel','unknown'))" 2>/dev/null)
  info "Default model: $DEFAULT_MODEL"

  # Check which models are enabled
  python3 -c "
import json
with open('$AI_CONFIG') as f:
    d = json.load(f)
for name, cfg in d.get('models', {}).items():
    status = 'ENABLED' if cfg.get('enabled') else 'disabled'
    print(f'  {name}: {status} (provider={cfg.get(\"provider\")}, model={cfg.get(\"model\")})')
" 2>/dev/null | while IFS= read -r line; do
    info "$line"
  done

  FALLBACK=$(python3 -c "import json; d=json.load(open('$AI_CONFIG')); print(' -> '.join(d.get('fallbackOrder',[])))" 2>/dev/null)
  info "Fallback order: $FALLBACK"
else
  fail "ai.json not found at $AI_CONFIG"
fi

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "============================================="
echo "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo "============================================="
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${YELLOW}Troubleshooting:${NC}"
  echo ""
  echo "  If Codex CLI token is expired:"
  echo "    codex auth login"
  echo ""
  echo "  If Codex CLI is not installed:"
  echo "    npm install -g @openai/codex"
  echo ""
  echo "  If refresh_token is revoked:"
  echo "    codex auth login   (re-authenticates via browser)"
  echo ""
  echo "  To force-refresh tokens without re-login:"
  echo "    node scripts/test-ai.mjs --refresh"
  echo ""
  echo "  To use Anthropic Claude only (skip Codex):"
  echo "    Edit _config/ai.json -> set codex.enabled = false"
  echo "    Ensure ANTHROPIC_API_KEY is set in .env.local"
  echo ""
fi

exit $FAIL

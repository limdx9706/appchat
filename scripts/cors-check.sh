#!/usr/bin/env bash
# api.deepseek.com CORS 预检冒烟：验证 5 个端点是否允许浏览器直连（BYOK 纯静态架构的前提）。
# 用法：bash scripts/cors-check.sh [页面Origin] ；API 地址可用环境变量 API_ORIGIN 覆盖。
set -u

ORIGIN="${1:-https://chat.ldx9706.cloud}"
API="${API_ORIGIN:-https://api.deepseek.com}"

# 端点 = METHOD + PATH + 预检要带的请求头
check() {
  local method="$1" path="$2" req_headers="$3"
  local label="$method $path"
  local output
  output=$(curl -sS -o /dev/null -D - -X OPTIONS "$API$path" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: $method" \
    -H "Access-Control-Request-Headers: $req_headers" \
    --max-time 15 2>&1) || true

  local allow_origin allow_methods allow_headers
  # 只取冒号后的值，去掉头名前缀；methods 去空格便于 ",GET," 比对
  allow_origin=$(printf '%s' "$output" | grep -i '^access-control-allow-origin:' | tr -d '\r' | tail -1 | sed 's/^[A-Za-z-]*: *//')
  allow_methods=$(printf '%s' "$output" | grep -i '^access-control-allow-methods:' | tr -d '\r' | tail -1 | sed 's/^[A-Za-z-]*: *//' | tr -d ' ')
  allow_headers=$(printf '%s' "$output" | grep -i '^access-control-allow-headers:' | tr -d '\r' | tail -1 | sed 's/^[A-Za-z-]*: *//')

  local verdict=FAIL reason=""
  if [[ $allow_origin == *"$ORIGIN"* || $allow_origin == *'*'* ]]; then
    if [[ ",${allow_methods}," == *",${method},"* || ",${allow_methods}," == *",*,"* ]]; then
      # 逐个确认页面真正会发的头都在 allow-headers 里（大小写不敏感子串比较）
      local ok_headers=true
      local lower_all
      lower_all=$(printf '%s' "$allow_headers" | tr 'A-Z' 'a-z')
      local header
      for header in $(printf '%s' "$req_headers" | tr ',' ' '); do
        if [[ $lower_all != *"$(printf '%s' "$header" | tr 'A-Z' 'a-z')"* ]]; then
          ok_headers=false
          reason="missing header: $header"
        fi
      done
      if [[ $ok_headers == true ]]; then
        verdict=PASS
      fi
    else
      reason="method $method not allowed ($allow_methods)"
    fi
  else
    reason="origin not allowed ($allow_origin)"
  fi

  printf '%-38s %s%s\n' "$label" "$verdict" "${reason:+  <- $reason}"
  [[ $verdict == PASS ]]
}

echo "CORS preflight check against: $API (Origin: $ORIGIN)"
echo "----------------------------------------------------------------"

fail=0
check GET  /models                        "authorization"                                      || fail=1
check POST /anthropic/v1/messages         "content-type,x-api-key,anthropic-beta,authorization" || fail=1
check POST /anthropic/v1/files            "content-type,x-api-key,anthropic-beta"              || fail=1
check POST /v1/tools/asr                  "authorization"                                      || fail=1
check POST /v1/tools/tts                  "authorization,content-type"                          || fail=1

echo "----------------------------------------------------------------"
if [[ $fail -eq 0 ]]; then
  echo "All 5 endpoints allow browser access."
else
  echo "Some endpoints FAILED the preflight — see above."
fi
exit $fail

#!/bin/zsh
# usage: run-pi.sh <worktree> <provider> <model> <thinking> <prompt file> <log>
# Runs pi in the worktree. If no model reply lands in its session file within
# 300 s and the worktree has no changes either, stops
# pi only (never its children: pi may own the proxy) and tries again.
wt=$1; prov=$2; model=$3; think=$4; prompt=$5; log=$6
d=~/.pi/agent/sessions/--Users-paul-Documents-GitHub-${wt:t}--
mkdir -p $d
for try in 1 2 3; do
  before=$(ls $d)
  ( cd $wt && exec pi --provider $prov --model $model --thinking $think -p "$(cat $prompt)" ) > $log 2>&1 &
  pid=$!
  ok=0
  for i in $(seq 60); do
    perl -e 'select(undef,undef,undef,5)'
    new=$(comm -13 <(echo $before) <(ls $d) | head -1)
    if [ -n "$new" ] && grep -q '"usage"' $d/$new 2>/dev/null; then ok=1; break; fi
    [ -n "$(cd $wt && git status --short | grep -v node_modules)" ] && { ok=1; break; }
    kill -0 $pid 2>/dev/null || { ok=1; break; }
  done
  if [ $ok = 1 ]; then wait $pid; echo "${wt:t}: exit $? (try $try)"; tail -c 1500 $log; exit 0; fi
  echo "${wt:t}: no reply in 300 s on try $try, restarting"
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
done
echo "${wt:t}: gave up after 3 tries"; exit 1

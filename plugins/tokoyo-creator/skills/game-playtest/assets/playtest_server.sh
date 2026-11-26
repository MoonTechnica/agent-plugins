#!/usr/bin/env bash
# 対戦サーバーのルールの自己試遊（playtest_server.gd）を回し、実行時エラーまで見て終了コードにする。
# ゲームの `scripts/playtest_server.sh` にコピーして使う（`scripts/playtest_server.gd` も一緒に）。
#   scripts/playtest_server.sh                                 # res://server/rules.gd・2 席
#   scripts/playtest_server.sh res://server/rules.gd 4         # 別のルール・席数
# GDScript の実行時エラー（型の食い違い・null の呼び出しなど）は例外にならず、Godot は止まらずに続ける。
# `SCRIPT ERROR` が 1 行でも出たら失敗にする。
set -uo pipefail
cd "$(dirname "$0")/.."
godot="${GODOT_BIN:-godot}"
out="$("$godot" --headless --path godot --script ../scripts/playtest_server.gd -- "$@" 2>&1)"
code=$?
printf '%s\n' "$out"
if grep -qE "SCRIPT ERROR|^ERROR:" <<<"$out"; then
	echo "✗ 実行時エラー（SCRIPT ERROR / ERROR:）が出ている。上の行の場所を直す"
	exit 1
fi
if ! grep -qE "^(✓|✗)" <<<"$out"; then
	echo "✗ ✓ も ✗ も 1 行も出ていない（スクリプトを読めていない）"
	exit 1
fi
exit "$code"

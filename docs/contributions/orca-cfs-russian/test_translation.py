"""Offline checks: parse source and run isolated UI scripts, never import the plugin.

Usage: python test_translation.py [--baseline baseline.py] [--translated cloud_plugin.py]
Node.js on PATH is required for the embedded JavaScript checks.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import types
import unittest

parser = argparse.ArgumentParser()
parser.add_argument("--baseline", type=Path, default=Path(__file__).with_name("baseline.py"))
parser.add_argument("--translated", type=Path, default=Path(__file__).with_name("cloud_plugin.py"))
args, unittest_args = parser.parse_known_args()
old_source = args.baseline.read_text(encoding="utf-8")
source = args.translated.read_text(encoding="utf-8")
old_tree, tree = ast.parse(old_source), ast.parse(source)


def constants(parsed):
    return {node.targets[0].id: ast.literal_eval(node.value) for node in parsed.body
            if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
            and node.targets[0].id in {
                "_DEFAULTS", "FRASI_CHIARE", "PAGINA", "TITOLI_GUIDA", "GUIDE", "PAGINA_GUIDA", "TITOLI_STAMPANTE", "PAGINA_STAMPANTE",
            }}


old, new = constants(old_tree), constants(tree)


def function(name):
    return next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)


def method(name):
    cls = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "CfsSync")
    return next(node for node in cls.body if isinstance(node, ast.FunctionDef) and node.name == name)


def isolated(nodes, **namespace):
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "<isolated-source>", "exec"), namespace)
    return namespace


class TranslationTests(unittest.TestCase):
    def test_baseline_is_exact_installed_version(self):
        self.assertEqual(hashlib.sha256(args.baseline.read_bytes()).hexdigest(),
                         "d676e2da7ce145428e8a443ee31df05a7481347cf1a642cae0430ecf169da9bb")

    def test_only_localization_changes(self):
        normalized = source.replace('("it", "en", "de", "fr", "es", "ru")', '("it", "en", "de", "fr", "es")')
        normalized = normalized.replace(
            'self._stato_per_pannello()["lingua"] if self._stato_per_pannello()["lingua"] in ("it", "ru") else "en"',
            '"it" if self._stato_per_pannello()["lingua"] == "it" else "en"')
        def without_ui_constants(parsed):
            parsed.body = [node for node in parsed.body if not (isinstance(node, ast.Assign)
                and isinstance(node.targets[0], ast.Name) and node.targets[0].id in old)]
            return ast.dump(parsed, include_attributes=False)
        self.assertEqual(without_ui_constants(ast.parse(normalized)), without_ui_constants(ast.parse(old_source)))

    def test_existing_python_translations_unchanged(self):
        for name in ("FRASI_CHIARE", "TITOLI_GUIDA", "GUIDE", "TITOLI_STAMPANTE"):
            self.assertEqual({key: value for key, value in new[name].items() if key != "ru"}, old[name], name)
        defaults = dict(new["_DEFAULTS"])
        defaults["lingue_possibili"] = old["_DEFAULTS"]["lingue_possibili"]
        self.assertEqual(defaults, old["_DEFAULTS"])
        self.assertEqual(set(new["FRASI_CHIARE"]["ru"]), set(old["FRASI_CHIARE"]["en"]))
        for key, value in new["FRASI_CHIARE"]["ru"].items():
            self.assertEqual(set(re.findall(r"\{\w+\}", value)), set(re.findall(r"\{\w+\}", old["FRASI_CHIARE"]["en"][key])), key)

    def test_language_detection_and_window_fallback(self):
        for code, expected in (("ru", "ru"), ("ru_RU", "ru"), ("ru-RU", "ru"), ("RU", "ru"),
                               ("de_DE", "de"), ("it", "it"), ("unknown", "en"), ("", "en")):
            host = types.SimpleNamespace(app_language=lambda: code, app_info=lambda: {"language": code})
            fn = isolated([function("lingua_orca")], orca=types.SimpleNamespace(host=host))["lingua_orca"]
            self.assertEqual(fn(), expected, code)
        fn = isolated([method("_lingua_finestre")])["_lingua_finestre"]
        for code, expected in (("ru", "ru"), ("it", "it"), ("en", "en"), ("de", "en"), ("fr", "en"), ("es", "en")):
            obj = types.SimpleNamespace(_stato_per_pannello=lambda: {"lingua": code})
            self.assertEqual(fn(obj), expected, code)

    def test_optional_native_sync_strings_are_pure_data(self):
        namespace = isolated([function(name) for name in ("sostituisci_nome", "voci_con_nome", "leggi_mo", "scrivi_mo")],
                             re=re, struct=struct, ARTICOLI={}, FRASI_CHIARE=new["FRASI_CHIARE"])
        values = namespace["voci_con_nome"]([(b"Other", "Другая строка".encode())], [], "CFS", "ru")
        messages = dict(namespace["leggi_mo"](namespace["scrivi_mo"](values)))
        self.assertEqual(messages[b"Other"].decode(), "Другая строка")
        self.assertEqual(messages[b"Overwriting"].decode(), "По порядку")
        self.assertIn("CFS", messages[b"Synchronize AMS Filament Information"].decode())
        self.assertNotRegex(" ".join(value.decode() for value in messages.values()), r"\{(?:nome|del_nome)\}")

    def test_embedded_ui_translation_coverage_and_behaviour(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js is required to validate the UI scripts")
        check = Path(__file__).with_name("test_ui.js")
        data = json.dumps({"old": old, "new": new}, ensure_ascii=False)
        result = subprocess.run([node, str(check)], input=data, text=True, encoding="utf-8", capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("offline UI checks passed", result.stdout)


if __name__ == "__main__":
    unittest.main(argv=[__file__, *unittest_args])

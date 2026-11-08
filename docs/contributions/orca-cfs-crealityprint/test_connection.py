"""Offline tests of the real CfsSync class extracted by AST; no plugin import or network/UI."""
import argparse
import ast
import copy
import hashlib
import json
from pathlib import Path
import sys
import threading
import time
import types
import unittest
import urllib.parse

SOURCE = Path("cfs.py")
A = "http://192.0.2.123"
AM = A + ":7125"
B = "http://192.0.2.124"
BM = B + ":7125"
PLA = {"marca": "Example", "nome": "PLA", "profilo": "Example PLA", "tipo": "PLA"}
OTHER = {"marca": "Other", "nome": "PETG", "profilo": "Other PETG", "tipo": "PETG"}


def canonical_ast(value):
    """Serialize explicit AST fields consistently across Python 3.12+ dump defaults."""
    if isinstance(value, ast.AST):
        return [type(value).__name__, [[name, canonical_ast(item)] for name, item in ast.iter_fields(value)]]
    if isinstance(value, list):
        return [canonical_ast(item) for item in value]
    if isinstance(value, bytes):
        return ["bytes", value.hex()]
    return value


class FakeCapability:
    def __init__(self):
        self.config = {}
        self.saves = []

    def get_config(self):
        return json.dumps(self.config)

    def save_config(self, value):
        self.config = json.loads(value)
        self.saves.append(copy.deepcopy(self.config))


def load_class():
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    names = {"normalize_host", "resolve_moonraker_host", "chiave_filamento", "CfsSync", "MoonrakerError"}
    nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in names]
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id in {
                "_DEFAULTS", "VERSIONE", "TIMEOUT_SECONDS", "FOREGROUND_TIMEOUT_SECONDS"}:
            nodes.append(node)
    # Constants precede class creation because default arguments are evaluated then.
    nodes.sort(key=lambda node: (not isinstance(node, ast.Assign), node.lineno))
    orca = types.SimpleNamespace(script=types.SimpleNamespace(ScriptPluginCapabilityBase=FakeCapability),
                                 LifecycleEvent=types.SimpleNamespace(DeviceSelected=object()),
                                 ExecutionResult=types.SimpleNamespace(success=lambda message: (True, message),
                                                                       failure=lambda message: (False, message)))
    namespace = {"orca": orca, "threading": threading, "time": time, "json": json, "urllib": urllib,
                 "LETTURE_HOST": [], "lingua_orca": lambda: "en", "lingua_orca_completa": lambda: "en"}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "<isolated CfsSync>", "exec"), namespace)
    return namespace


class Harness:
    def __init__(self, settings=None, selected=A):
        self.ns = load_class()
        self.selected = selected
        self.urls = []
        self.syncs = []
        self.uploads = []
        self.project = []
        self.on_query = lambda client: [{"numero": 1, "slot": []}]
        self.on_sync = lambda client, response: {"written": 4}
        self.on_adl = lambda client: True
        self.on_printing = lambda client: False
        self.on_upload = lambda client, material: "ok"
        harness = self

        class FakeMoonraker:
            def __init__(self, url, timeout=5):
                self.url, self.timeout = url, timeout
                harness.urls.append(url)

            def query_box(self):
                return harness.on_query(self)

        def sync(client, response):
            self.syncs.append(client.url)
            return self.on_sync(client, response)

        def upload(client, material):
            self.uploads.append((client.url, copy.deepcopy(material)))
            return self.on_upload(client, material)

        self.ns.update(Moonraker=FakeMoonraker, host_da_preset=lambda: self.selected,
                       slot_pannello=lambda response: response, sync=sync,
                       ha_adl=lambda client: self.on_adl(client), in_stampa=lambda client: self.on_printing(client),
                       carica_con_adl=upload, filamenti_del_progetto=lambda: copy.deepcopy(self.project),
                       sincronizza_orca=lambda language: True)
        self.plugin = self.ns["CfsSync"]()
        self.plugin.config = {**copy.deepcopy(self.ns["_DEFAULTS"]), **copy.deepcopy(settings or {})}
        self.plugin._apri_pannello = lambda: None
        self.plugin._apri_stampante = lambda: None
        self.plugin._poller_running = lambda: False
        self.plugin._start_in_foreground = lambda: self.plugin._sync_now(timeout=2)

    def select(self, selected):
        self.selected = selected
        self.plugin._refresh_connection()


class ConnectionTests(unittest.TestCase):
    def test_code_outside_connection_scope_is_unchanged(self):
        after = ast.parse(SOURCE.read_text(encoding="utf-8"))
        changed_methods = {"__init__", "_sync_now", "_carica_filamenti", "_refresh_connection", "_avvia",
                           "_stato_per_pannello", "on_message", "on_message_guida", "on_message_stampante",
                           "on_lifecycle_event", "execute"}
        def strip(parsed):
            result = []
            for node in parsed.body:
                if isinstance(node, ast.FunctionDef) and node.name == "resolve_moonraker_host":
                    continue
                if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id == "_DEFAULTS":
                    values = ast.literal_eval(node.value)
                    values.pop("moonraker_hosts", None)
                    values.pop("caricati_per_host", None)
                    node.value = ast.parse(repr(values), mode="eval").body
                if isinstance(node, ast.ClassDef) and node.name == "CfsSync":
                    node.body = [method for method in node.body if not (isinstance(method, ast.FunctionDef) and method.name in changed_methods)]
                result.append(node)
            return json.dumps(canonical_ast(ast.Module(body=result, type_ignores=[])), ensure_ascii=False, separators=(",", ":"))
        digest = hashlib.sha256(strip(after).encode("utf-8")).hexdigest()
        self.assertEqual(digest, "62ef33e020d0599b0da78c48e8f8a48bab14ab02806b5997715eb6de9901e069")

    def test_resolver_normalization_defaults_and_invalid_fail_closed(self):
        resolve = load_class()["resolve_moonraker_host"]
        cases = [
            ("192.0.2.123/", {"http://192.0.2.123/path": "192.0.2.123:7125/"}, AM),
            (AM, {A: AM}, AM), (B, {A: AM}, B), (A, {}, A),
            ("invalid_serial", {A: AM}, ""), (A, {A: "invalid_serial"}, ""),
            (A, {A: None}, ""), (A, [AM], ""), (A, "bad mapping", ""),
            ("", {A: AM}, ""), ("https://192.0.2.123:7125/", {}, "https://192.0.2.123:7125"),
        ]
        for selected, mapping, expected in cases:
            with self.subTest(selected=selected, mapping=mapping):
                self.assertEqual(resolve(selected, mapping), expected)
        self.assertEqual(load_class()["_DEFAULTS"]["moonraker_hosts"], {})

    def test_all_gui_routes_use_alias_and_preserve_selected_print_host(self):
        for route in ("avvia", "execute", "stato", "lifecycle", "sync"):
            with self.subTest(route=route):
                h = Harness({"moonraker_hosts": {A: AM}, "host": AM, "caricati": ["Example|PLA"]})
                p = h.plugin
                if route == "avvia":
                    p._avvia()
                elif route == "execute":
                    self.assertTrue(p.execute()[0])
                elif route == "stato":
                    p.on_message({"comando": "stato"})
                    p._sync_now()
                elif route == "lifecycle":
                    p.on_lifecycle_event(h.ns["orca"].LifecycleEvent.DeviceSelected,
                                         types.SimpleNamespace(name="A pretty name", device_id=B))
                else:
                    p.on_message({"comando": "sincronizza"})
                self.assertEqual(p._host, AM)
                self.assertEqual(h.urls, [AM])
                self.assertEqual(h.syncs, [AM])
                self.assertEqual(h.selected, A)
                self.assertEqual(p.config["moonraker_hosts"], {A: AM})

    def test_legacy_fallback_without_mapping_is_preserved(self):
        h = Harness({"host": AM, "caricati": ["Example|PLA"]}, selected="")
        h.plugin._refresh_connection()
        self.assertEqual(h.plugin._host, AM)
        self.assertEqual(h.plugin._carica["caricati"], ["Example|PLA"])
        h.select(B)
        self.assertEqual(h.plugin._host, B)

    def test_unmatched_selection_and_bad_mapping_do_not_use_saved_fallback(self):
        for mapping, selected, expected in (({A: AM}, B, B), ({A: "invalid_serial"}, A, ""),
                                             ([AM], A, ""), ({A: None}, A, "")):
            with self.subTest(mapping=mapping, selected=selected):
                h = Harness({"host": AM, "caricati": ["Example|PLA"], "moonraker_hosts": mapping}, selected=selected)
                p = h.plugin
                p.on_message({"comando": "stato"})
                p._sync_now()
                self.assertEqual(p._host, expected)
                self.assertEqual(h.urls, [expected] if expected else [])
                self.assertEqual(p._stato_per_pannello()["host"], expected.replace("http://", ""))

    def test_first_empty_selection_clears_legacy_and_no_resurrection(self):
        h = Harness({"moonraker_hosts": {A: AM}, "host": AM, "caricati": ["Example|PLA"]}, selected="")
        p = h.plugin
        self.assertTrue(p._refresh_connection())
        self.assertEqual(p._host, "")
        self.assertEqual(p.config["caricati_per_host"][AM], ["Example|PLA"])
        self.assertEqual(p._carica["caricati"], [])
        self.assertIsNone(p._sync_now())
        self.assertEqual(h.urls, [])
        self.assertEqual(p._stato_per_pannello()["host"], "")
        self.assertEqual(p._stato["errore"], "senza_stampante")

    def test_a_b_empty_separate_cache_and_latest_memory_wins(self):
        h = Harness({"moonraker_hosts": {A: AM, B: BM}, "host": A,
                     "caricati": ["Example|PLA"], "caricati_per_host": {AM: ["old"], BM: ["Other|PETG"]}})
        p = h.plugin
        h.select(A)
        self.assertEqual(p._carica["caricati"], ["Example|PLA"])
        p._carica.update(adl=True, caricati=["Example|PLA", "New|PLA"], errore="old", mancano=["old"])
        p._riprova["old"] = 100
        p._errori["old"] = "old"
        p._da_caricare = [PLA]
        p._stato = {"connessa": True, "unita": ["old"]}
        h.select(B)
        self.assertEqual(p._host, BM)
        self.assertEqual(p._carica, {"adl": None, "caricati": ["Other|PETG"], "mancano": [], "errore": ""})
        self.assertEqual(p._stato["unita"], [])
        self.assertFalse(p._stato["connessa"])
        self.assertEqual(p._riprova, {})
        self.assertEqual(p._errori, {})
        self.assertEqual(p._da_caricare, [])
        self.assertEqual(p.config["caricati_per_host"][AM], ["Example|PLA", "New|PLA"])
        h.select("")
        self.assertEqual(p._host, "")
        self.assertEqual(p._carica["caricati"], [])
        self.assertIsNone(p._sync_now())
        self.assertEqual(h.urls, [])
        self.assertEqual(p.config["caricati_per_host"][BM], ["Other|PETG"])
        h.select(A)
        self.assertEqual(p._carica["caricati"], ["Example|PLA", "New|PLA"])

    def test_same_endpoint_refresh_does_not_write_or_reset(self):
        h = Harness({"moonraker_hosts": {A: AM}, "host": AM, "caricati": ["Example|PLA"]})
        p = h.plugin
        self.assertTrue(p._refresh_connection())
        saves = len(p.saves)
        p._carica["adl"] = True
        p._stato["connessa"] = True
        for _ in range(3):
            self.assertFalse(p._refresh_connection())
        self.assertEqual(len(p.saves), saves)
        self.assertTrue(p._stato["connessa"])
        self.assertTrue(p._carica["adl"])

    def test_loaded_material_is_not_uploaded_again_and_new_uses_7125(self):
        h = Harness({"moonraker_hosts": {A: AM}, "host": AM, "caricati": ["Example|PLA"]})
        p = h.plugin
        p._refresh_connection()
        h.project = [PLA]
        p.on_message({"comando": "stato"})
        p._carica_filamenti()
        self.assertEqual(h.uploads, [])
        self.assertEqual(p._carica["mancano"], [])
        self.assertEqual(p._carica["caricati"], ["Example|PLA"])
        h.project.append(OTHER)
        p.on_message({"comando": "stato"})
        p._carica_filamenti()
        self.assertEqual(h.uploads, [(AM, OTHER)])
        self.assertEqual(p._carica["caricati"], ["Example|PLA", "Other|PETG"])
        p.on_message({"comando": "stato"})
        self.assertEqual(p.config["caricati"], ["Example|PLA", "Other|PETG"])

    def test_stale_sync_query_and_later_summary_do_not_publish(self):
        for phase in ("query", "sync", "error"):
            with self.subTest(phase=phase):
                h = Harness({"moonraker_hosts": {A: AM, B: BM}})
                p = h.plugin
                p._refresh_connection()
                def switch(*args):
                    h.select(B)
                    if phase == "error":
                        raise h.ns["MoonrakerError"]("late A failure")
                    return [] if phase == "query" else {"written": 4}
                if phase in ("query", "error"):
                    h.on_query = switch
                else:
                    h.on_sync = switch
                if phase == "error":
                    with self.assertRaises(h.ns["MoonrakerError"]):
                        p._sync_now()
                else:
                    self.assertIsNone(p._sync_now())
                self.assertEqual(p._host, BM)
                self.assertEqual(p._stato, {"connessa": False, "unita": [], "errore": "", "ora": ""})
                if phase == "query":
                    self.assertEqual(h.syncs, [])

    def test_stale_material_results_do_not_change_new_printer(self):
        for phase in ("ha_adl", "in_stampa", "upload_ok", "upload_error"):
            with self.subTest(phase=phase):
                h = Harness({"moonraker_hosts": {A: AM, B: BM}, "host": AM,
                             "caricati_per_host": {BM: ["Existing|B"]}})
                p = h.plugin
                p._refresh_connection()
                p._da_caricare = [PLA, OTHER]
                def switch(client, material=None):
                    h.select(B)
                    return False if phase == "in_stampa" else "old A error" if phase == "upload_error" else True if phase == "ha_adl" else "ok"
                if phase == "ha_adl":
                    h.on_adl = switch
                elif phase == "in_stampa":
                    h.on_printing = switch
                else:
                    h.on_upload = switch
                p._carica_filamenti()
                self.assertEqual(p._host, BM)
                self.assertEqual(p._carica, {"adl": None, "caricati": ["Existing|B"], "mancano": [], "errore": ""})
                self.assertEqual(p._errori, {})
                self.assertEqual(p._riprova, {})
                self.assertEqual(len(h.uploads), 1 if phase.startswith("upload") else 0)
                self.assertTrue(all(url == AM for url, _ in h.uploads))

    def test_refresh_cannot_publish_new_host_with_previous_materials(self):
        h = Harness({"moonraker_hosts": {A: AM, B: BM}, "host": AM})
        p = h.plugin
        p._refresh_connection()
        p._da_caricare = [PLA]
        p._carica["caricati"] = []
        h.selected = B
        observed = []
        code = p._refresh_connection.__func__.__code__
        def step(frame, event, arg):
            if frame.f_code is code and event == "line":
                # Force the poller to run between every individual refresh line.
                observed.append((p._host, list(p._da_caricare)))
                p._carica_filamenti()
            return step
        try:
            sys.settrace(step)
            p._refresh_connection()
        finally:
            sys.settrace(None)
        self.assertEqual(p._host, BM)
        self.assertTrue(any(host == BM for host, _ in observed))
        self.assertFalse(any(host == BM and pending for host, pending in observed))
        self.assertFalse(any(url == BM for url, _ in h.uploads))

    def test_independent_materials_and_guide_windows_refresh_connection(self):
        for route in ("materials_status", "materials_load", "guide_status"):
            with self.subTest(route=route):
                h = Harness({"moonraker_hosts": {A: AM, B: BM}, "host": AM, "caricati": ["Example|PLA"]})
                p = h.plugin
                p._refresh_connection()
                p.on_close()
                h.selected = B
                h.project = [OTHER]
                if route == "guide_status":
                    p.on_message_guida({"comando": "stato"})
                else:
                    p.on_message_stampante({"comando": "stato" if route == "materials_status" else "carica"})
                self.assertEqual(p._host, BM)
                self.assertEqual(p._da_caricare, [OTHER])
                p._carica_filamenti()
                self.assertEqual(h.uploads, [(BM, OTHER)])
                self.assertEqual(p.config["caricati_per_host"][AM], ["Example|PLA"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Path to CFS 0.12.1 source with connection-fix.patch applied")
    arguments, unittest_arguments = parser.parse_known_args()
    SOURCE = arguments.source.resolve()
    if not SOURCE.is_file():
        parser.error("--source must name an existing patched CFS source file")
    unittest.main(argv=[sys.argv[0], *unittest_arguments])

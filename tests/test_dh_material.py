"""El ejemplo matemático de la guía DH debe seguir dando la pose esperada."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

import numpy as np


class CodeBlocks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.blocks = []
        self.inside = False

    def handle_starttag(self, tag, attrs):
        if tag == "code" and self.get_starttag_text() and "<pre" not in self.get_starttag_text():
            # The first multiline block is recognized from its text below.
            self.inside = True
            self.blocks.append("")

    def handle_endtag(self, tag):
        if tag == "code":
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.blocks[-1] += data


class DhMaterialTests(unittest.TestCase):
    def test_two_link_example_and_matrix(self):
        source = Path(__file__).resolve().parents[1] / "material_docente" / "07_dh_robot_manipulador.html"
        parser = CodeBlocks()
        parser.feed(source.read_text(encoding="utf-8"))
        code = next(block for block in parser.blocks if block.startswith("def A_dh("))
        namespace = {"np": np, "plot": lambda *args: None}
        exec(code, namespace, namespace)
        np.testing.assert_allclose(namespace["T"][:3, 3], [2, 1, 0], atol=1e-12)
        np.testing.assert_allclose(namespace["T"][:3, :3].T @ namespace["T"][:3, :3], np.eye(3), atol=1e-12)

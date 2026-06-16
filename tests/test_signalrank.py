from pathlib import Path
import unittest

from src.parsing.loaders import load_demo_dataset
from src.scoring.baseline_ranker import rank_by_naive_keyword_overlap
from src.scoring.signalrank import rank_by_signalrank


class SignalRankDemoTest(unittest.TestCase):
    def test_signalrank_corrects_naive_keyword_winner(self) -> None:
        jd, candidates = load_demo_dataset(Path("data"))

        naive_top = rank_by_naive_keyword_overlap(jd, candidates)[0]["name"]
        signal_top = rank_by_signalrank(jd, candidates)[0]["name"]

        self.assertEqual(naive_top, "Aarav Keyword")
        self.assertEqual(signal_top, "Meera Evidence")
        self.assertNotEqual(naive_top, signal_top)

    def test_hidden_gem_beats_keyword_stuffed_candidate(self) -> None:
        jd, candidates = load_demo_dataset(Path("data"))
        rankings = rank_by_signalrank(jd, candidates)
        positions = {result["name"]: index for index, result in enumerate(rankings)}

        self.assertLess(positions["Riya HiddenGem"], positions["Aarav Keyword"])


if __name__ == "__main__":
    unittest.main()


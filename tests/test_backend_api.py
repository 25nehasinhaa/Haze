import unittest

from fastapi.testclient import TestClient

from backend.app.main import app


class BackendApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health(self) -> None:
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_demo_ranking_response(self) -> None:
        response = self.client.get("/api/demo")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ranking_corrected"])
        self.assertEqual(payload["naive_top"], "Aarav Keyword")
        self.assertEqual(payload["signalrank_top"], "Meera Evidence")
        self.assertGreaterEqual(len(payload["candidates"]), 4)

    def test_evaluation(self) -> None:
        response = self.client.get("/api/evaluate")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["score"], 100.0)


if __name__ == "__main__":
    unittest.main()


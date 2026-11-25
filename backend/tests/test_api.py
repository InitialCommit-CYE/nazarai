"""API tests. They use the UNTRAINED pipeline-test artefact, so they check plumbing and contracts,
never prediction accuracy."""

H = {"X-API-Key": "test-key"}


def _post(client, data: bytes, name="x.jpg", ctype="image/jpeg", headers=H, path="/predict"):
    return client.post(path, files={"image": (name, data, ctype)}, headers=headers)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["model_loaded"] is True
    assert body["model"]["trained"] is False  # pipeline-test artefact is flagged
    assert body["gradcam_available"] is True


def test_requires_api_key(client, demo_bytes):
    assert _post(client, demo_bytes("grade0-no-dr.jpg"), headers={}).status_code == 401
    assert _post(client, demo_bytes("grade0-no-dr.jpg"), headers={"X-API-Key": "wrong"}).status_code == 401


def test_predict_good_image(client, demo_bytes):
    r = _post(client, demo_bytes("grade3-severe.jpg"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["quality"]["ok"] is True
    g = body["grading"]
    assert 0 <= g["grade"] <= 4 and g["urgency"] in {"routine", "refer", "urgent"}
    assert len(g["tta_scores"]) == 4
    assert body["images"]["display_png_base64"] and body["images"]["heatmap_png_base64"]
    assert body["model"]["trained"] is False


def test_rejected_image_is_never_graded(client, demo_bytes):
    r = _post(client, demo_bytes("unsuitable-low-quality.jpg"))
    assert r.status_code == 200
    body = r.json()
    assert body["quality"]["ok"] is False
    assert body["grading"] is None and body["images"] is None


def test_invalid_type_and_payload(client):
    assert _post(client, b"hello", name="a.txt", ctype="text/plain").status_code == 415
    assert _post(client, b"not really a jpeg").status_code == 422


def test_metrics_pending_or_present(client):
    r = client.get("/metrics", headers=H)
    assert r.status_code == 200
    assert "status" in r.json()


def test_pdf_en_and_ur(client):
    req = {"screening_id": "0b9a7c1e-1111-2222-3333-444455556666", "created_at": "2026-11-25T10:00:00Z",
           "demo_patient_code": "DEMO-0042", "age": 54, "diabetes_duration_years": 9, "grade": 3,
           "grade_label": "Severe NPDR", "confidence": 0.81, "referable": True, "urgency": "urgent",
           "model_version": "test", "is_development_model": True}
    for lang, text in (("en", "Your screening suggests changes in the retina."),
                       ("ur", "آپ کی اسکریننگ میں آنکھ کے پردے میں تبدیلیاں نظر آئیں۔")):
        r = client.post("/generate-pdf", json={**req, "language": lang, "report_text": text}, headers=H)
        assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
        assert r.content[:5] == b"%PDF-"

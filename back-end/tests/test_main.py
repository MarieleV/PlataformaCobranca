# tests/test_main.py
def test_health_check_retorna_online(client):
    response = client.get("/")
    
    assert response.status_code == 200
    dados = response.json()
    assert dados["status"] == "online"
    assert "version" in dados
import pytest
from src.app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_hello(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'Hello from my app!' in response.data

def test_health(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert b'healthy' in response.data
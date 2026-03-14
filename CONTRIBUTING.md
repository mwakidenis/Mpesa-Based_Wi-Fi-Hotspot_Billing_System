# Contributing to Mpesa-Based Wi-Fi Hotspot Billing System

<p align="center">
<strong><a href="#setup">Setup</a></strong> |
<strong><a href="#running-tests">Running Tests</a></strong> |
<strong><a href="#writing-tests">Writing Tests</a></strong> |
<strong><a href="#debugging-code">Debugging</a></strong> |
<strong><a href="#internals">Internals</a></strong> |
<strong><a href="#code-of-conduct">Code of Conduct</a></strong>
</p>

---

## Setup

1. Fork & clone the repository:

# bash
git clone https://github.com/<your-username>/Mpesa-Based_Wi-Fi-Hotspot_Billing_System
cd Mpesa-Based_Wi-Fi-Hotspot_Billing_System

Create & activate virtual environment:

# macOS/Linux
python -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Configure environment variables in .env:

FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=sqlite:///database.db
MPESA_CONSUMER_KEY=<your-key>
MPESA_CONSUMER_SECRET=<your-secret>

Initialize database & run:

python manage.py init-db
flask run
Running Tests
# Run all tests
pytest tests/

# Run a specific test file
pytest tests/test_payments.py

# Run a specific test function
pytest tests/test_payments.py::test_payment_success

# Run with coverage
pytest --cov=app tests/
Writing Tests

Place tests in tests/ folder with test_<module>.py naming.

Example:

def test_hotspot_login(client):
    response = client.post("/login", data={"username": "user", "password": "pass"})
    assert response.status_code == 200
    assert b"Welcome" in response.data
Debugging Code

Use Python debugger:

import pdb; pdb.set_trace()

Or use breakpoints in VS Code / PyCharm.

Internals

app.py – Flask entry point

payments.py – M-Pesa integration

hotspot.py – Hotspot login & billing

models.py – Database models

templates/ – HTML templates

static/ – CSS/JS assets

tests/ – Unit & integration tests

Creating a New Feature / Plugin

Fork repository & create a branch.

Implement your changes.

Add tests in tests/.

Ensure all tests pass.

Submit a pull request describing your feature.

Code of Conduct

Be respectful, welcoming, and constructive.

No harassment, personal attacks, or sharing private info.

Maintain professionalism in all interactions.

Enforcement Contact: mwakidenice@gmail.com

Full Code of Conduct: CODE_OF_CONDUCT.md

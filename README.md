# Imaginair

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Imaginair is a web application exploring collaborative art creation between humans and AI. It leverages hand-tracking technology via your webcam, allowing you to draw directly onto a virtual canvas using your fingertip.

## How It Works

1. **Draw with Motion:** Activate the webcam and use hand-tracking to paint directly onto the digital canvas. Pinching your index finger and thumb toggles the drawing mode on and off.
2. **Guide with Words:** Write a text prompt to describe the desired outcome or add context to your drawing.
3. **Collaborate:** Submit your visual input and text prompt. Imaginair sends this combined information to its backend.
4. **AI Generation:** An advanced AI image generation model interprets your drawing and prompt, creating a unique artwork that blends your input with its generative capabilities.

## Concept

As generative AI transforms creative fields, the question of authorship often arises: Is the creator the user who writes the prompt, or the machine that generates the image?

Imaginair explores a middle ground, focusing on **human-AI collaboration**. By requiring direct visual input through hand-tracked drawing alongside a text prompt, it gives the user significant control over fundamental artistic elements like composition and color. This process aims to make the interaction more tangible and the resulting artwork a true partnership between human intention and artificial intelligence.

## Live Demo

You can try Imaginair live here: **[https://imaginair.uk.r.appspot.com/](https://imaginair.uk.r.appspot.com/)**

*(Note: AI generation relies on external API availability and may require API keys)*

## Technology Stack

* **Frontend:** HTML, CSS, JavaScript, p5.js (for drawing canvas), Mediapipe Hands (for hand tracking)
* **Backend:** Python, Flask
* **Cloud Platform:** Google App Engine (Standard Environment)
* **Secrets Management:** Google Secret Manager (for API keys)
* **AI Model API:** [Fireworks AI](https://fireworks.ai/) (utilizing models like SSD-1B via their API)

## Running Locally (Optional)

To run this project on your local machine:

1. **Clone the repository:**

    ```bash
    git clone https://github.com/matipina/stable-drawings.git
    cd stable-drawings
    ```

2. **Set up Python environment:**

    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: .\venv\Scripts\activate
    pip install -r requirements.txt
    ```

3. **Create `.env` file:** Create a file named `.env` in the root directory and add your **Fireworks AI API key** and GCP Project ID:

    ```dotenv
    FIREWORKS_API_KEY=fw_your_key_here
    GOOGLE_CLOUD_PROJECT=your-gcp-project-id
    ```

4. **Set up Application Default Credentials (ADC):** Authenticate `gcloud` for local access to Google Secret Manager (which stores the Fireworks key for the deployed app, but ADC allows local code to fetch it too if needed, though the `.env` key is used primarily locally now):

    ```bash
    gcloud auth application-default login
    ```

5. **Run the Flask app:**

    ```bash
    python main.py
    ```

6. Open your browser to `http://127.0.0.1:5001`

## Dev commands

* `gcloud app deploy` - Deploys the current local version to App Engine.
* `gcloud app browse` - Opens the deployed application URL in your browser.
* `gcloud app logs tail -s default` - Streams logs from the deployed App Engine service.

---

*Developed by Matías Piña*

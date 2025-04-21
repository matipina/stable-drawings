import os
import io
from io import BytesIO
import base64
import re
from flask import Flask, render_template, request, jsonify
from PIL import Image
from google.cloud import secretmanager
from dotenv import load_dotenv
import logging

import fireworks.client
from fireworks.client.image import ImageInference, Answer


load_dotenv()

# --- Configuration ---
app = Flask(__name__,
            template_folder='templates',
            static_folder='static')

# Configure logging
logging.basicConfig(level=logging.INFO)


# --- Helper Functions ---
def get_fireworks_api_key():
    """Fetches the Fireworks AI API key from Google Secret Manager."""
    secret_id = "fireworks-api-key"
    version_id = "latest"
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")

    if not project_id:
        # Try getting from gcloud config (useful for local testing after ADC login)
        try:
            import subprocess
            project_id = subprocess.check_output(
                ["gcloud", "config", "get-value", "project"], text=True
            ).strip()
            logging.info(f"Determined Project ID from gcloud config: {project_id}")
        except Exception:
            logging.error("GOOGLE_CLOUD_PROJECT env var not set and gcloud project not found.")
            return None

    if not project_id:
         logging.error("Could not determine Google Cloud project ID.")
         return None

    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
        response = client.access_secret_version(request={"name": name})
        token = response.payload.data.decode("UTF-8")
        logging.info("Successfully fetched Fireworks AI API key.")
        return token
    except Exception as e:
        logging.error(f"Error fetching secret '{secret_id}': {e}", exc_info=True)
        return None


def base64_to_pil(img_base64):
    """Convert base64 image data (with data URI prefix) to PIL image."""
    try:
        image_data = re.sub('^data:image/.+;base64,', '', img_base64)
        pil_image = Image.open(BytesIO(base64.b64decode(image_data)))
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
        return pil_image
    except Exception as e:
        print(f"Error converting base64: {e}")
        return None


def pil_to_base64(pil_image, format="PNG"):
    """Convert PIL image to base64 string including the data URI prefix."""
    buffered = io.BytesIO()
    pil_image.save(buffered, format=format)
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{img_str}"


# --- Image Generation Function ---
def generate_image_fireworks_api(img_pil, prompt, steps=30, cfg_scale=9.0, seed=0):
    """Generates an image using the Fireworks AI ImageInference client."""
    api_key = get_fireworks_api_key()
    if not api_key:
        logging.error("Cannot generate image: Fireworks API key not available.")
        return None

    try:
        # Set the API key for the client library
        fireworks.client.api_key = api_key

        # Initialize the client for the specific model
        inference_client = ImageInference(model="SSD-1B")

        # Call the image_to_image method
        # Pass the PIL image object directly to 'init_image'
        answer: Answer = inference_client.image_to_image(
            init_image=img_pil, # Pass PIL image object
            prompt=prompt,
            cfg_scale=cfg_scale, # Mapped from guidance_scale
            # sampler=None, # Use default sampler
            steps=steps, # Mapped from num_inference_steps
            seed=seed,
            safety_check=False, # Or True if desired
            output_image_format="PNG", # Request PNG output,
            init_image_mode="IMAGE_STRENGTH", # Common mode for img2img
            image_strength=0.44
        )

        # Check the result
        if answer.image is None:
            logging.error(f"Fireworks API failed: {answer.finish_reason}")
            return None
        else:
            logging.info(f"Image generation successful (finish reason: {answer.finish_reason}).")
            # answer.image is already a PIL Image object
            return answer.image

    except Exception as e:
        logging.error(f"Error during Fireworks API call or processing: {e}", exc_info=True)
        return None
# --- Flask Routes ---


@app.route("/")
def home():
    """Serves the main HTML page."""
    return render_template("index.html")


@app.route('/predict', methods=['POST'])
def predict():
    """Receives drawing data and prompt, returns generated image."""
    # No model loading check needed anymore

    if not request.is_json:
        return jsonify({"msg": "error", "detail": "Request must be JSON"}), 400

    data = request.get_json()
    img_base64 = data.get('image')
    prompt = data.get('prompt', '')

    if not img_base64:
        return jsonify({"msg": "error", "detail": "Missing image data"}), 400

    img_pil = base64_to_pil(img_base64)
    if img_pil is None:
        return jsonify({"msg": "error", "detail": "Failed to process input image"}), 400

    if not prompt:
        prompt = 'A beautiful artwork based on the sketch, high quality, detailed' # Generic prompt

    # Call the Fireworks API generation function
    # Adjust parameters like steps, cfg_scale as needed
    result_pil = generate_image_fireworks_api(img_pil, prompt, steps=33, cfg_scale=8.0)

    if result_pil is None:
        return jsonify({"msg": "error", "detail": "Image generation failed on server"}), 500

    # Convert the result PIL image back to base64 to send to frontend
    result_base64 = pil_to_base64(result_pil, format="PNG")

    return jsonify({
        'msg': 'success',
        'img_data': result_base64
    })


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0',
            port=int(os.environ.get("PORT", 5001)))

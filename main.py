import os
import io
from io import BytesIO
import base64
import re
from flask import Flask, render_template, request, jsonify
from PIL import Image
from huggingface_hub import InferenceClient
from google.cloud import secretmanager
from dotenv import load_dotenv


load_dotenv()

# --- Configuration ---
app = Flask(__name__,
            template_folder='templates',
            static_folder='static')

# Define the Hugging Face model ID to use
HF_MODEL_ID = "stabilityai/stable-diffusion-xl-refiner-1.0"

# --- Helper Functions ---


def get_huggingface_token():
    """Fetches the Hugging Face token from Google Secret Manager."""
    secret_id = "huggingface-api-token"
    version_id = "latest"

    # Attempt to get project ID from environment 
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        # Fallback: Try to get it from gcloud config if running locally for testing
        try:
            import subprocess
            project_id = subprocess.check_output(
                ["gcloud", "config", "get-value", "project"], text=True
            ).strip()
        except Exception:
             print("Warning: GOOGLE_CLOUD_PROJECT env var not set and gcloud project not found.")
             # Handle error appropriately - maybe return None or raise Exception
             return None # Or raise an exception

    if not project_id:
         print("Error: Could not determine Google Cloud project ID.")
         return None

    try:
        # Create the Secret Manager client
        client = secretmanager.SecretManagerServiceClient()

        # Build the resource name of the secret version
        name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"

        # Access the secret version
        response = client.access_secret_version(request={"name": name})

        # Decode the secret payload
        token = response.payload.data.decode("UTF-8")
        # print("Successfully fetched Hugging Face token from Secret Manager.") # Optional debug log
        return token

    except Exception as e:
        print(f"Error fetching secret '{secret_id}' from Secret Manager: {e}")
        # Consider raising the exception or returning None based on how you want to handle failure
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


def generate_image_hf_api(img_pil, prompt):
    """Generates an image using Hugging Face InferenceClient (img2img refiner)."""
    hf_token = get_huggingface_token()
    if not hf_token:
        print("Error: Missing Hugging Face Token")
        return None

    try:
        print(f"Initializing InferenceClient for model: {HF_MODEL_ID}")
        # Instantiate the client within the function for simplicity
        client = InferenceClient(token=hf_token)

        # Convert input PIL image to bytes (client might prefer bytes)
        buffer = io.BytesIO()
        img_format = "PNG"
        img_pil.save(buffer, format=img_format)
        img_bytes = buffer.getvalue()
        print(
            f"Sending prompt '{prompt}' and {len(img_bytes)} image bytes to client.")

        # Make the call using the client's image_to_image method
        # The client handles the underlying API request structure
        result_image = client.image_to_image(
            image=img_bytes,  # Pass image bytes
            prompt=prompt,
            model=HF_MODEL_ID,
            guidance_scale=1,
            num_inference_steps=100,
            negative_prompt="text, watermark, lowres, low quality, worst quality, deformed, glitch, low contrast, noisy, saturation, blurry",
        )

        # result_image should be a PIL Image object if successful
        if isinstance(result_image, Image.Image):
            print("Successfully received PIL Image from InferenceClient.")
            # Ensure RGB if needed (though client likely handles this)
            if result_image.mode != "RGB":
                result_image = result_image.convert("RGB")
            return result_image
        else:
            print(
                f"InferenceClient returned unexpected type: {type(result_image)}")
            return None

    except Exception as e:
        # Catch potential errors from the client library or API interaction
        print(f"Error using InferenceClient: {e}")
        return None


# --- Flask Routes ---

@app.route("/")
def home():
    """Serves the main HTML page."""
    return render_template("index.html")


@app.route('/predict', methods=['POST'])
def predict():
    """Receives drawing data and prompt, returns generated image."""
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

    # Use a default prompt if none provided by user
    if not prompt:
        prompt = 'Imagine a beautiful scene that follows the composition of this image, but with a lot of creative freedom.'

    # Call the generation function using HF InferenceClient
    print(f'prompt: {prompt}')
    result_pil = generate_image_hf_api(img_pil, prompt)

    if result_pil is None:
        return jsonify({"msg": "error", "detail": "Image generation failed"}), 500

    # Convert the result PIL image back to base64 to send to frontend
    result_base64 = pil_to_base64(result_pil, format="PNG")

    return jsonify({
        'msg': 'success',
        'img_data': result_base64  # Includes data URI prefix
    })

# --- Main Execution ---


if __name__ == '__main__':
    # Runs the Flask development server locally
    app.run(debug=True, host='0.0.0.0', port=5001)

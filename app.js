const express = require("express");
const axios = require("axios");
const cors = require("cors");
const FormData = require("form-data");
require("dotenv").config();
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.use(cors());

const upload = multer();
app.use(upload.none());

const rateLimit = require("express-rate-limit");

const imageGenLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 15 minutes
  max: 12, // limit each IP to 20 requests per windowMs
  message: "Too many image requests from this IP, please try again later.",
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Endpoint to fetch data from Gelato's API
app.get("/get-price/:productUUID", async (req, res) => {
  const { productUUID } = req.params;
  const country = "IE";
  const currency = "EUR";

  try {
    const response = await axios.get(
      `https://product.gelatoapis.com/v3/products/${productUUID}/prices?country=${country}&currency=${currency}`,
      {
        headers: {
          "X-API-KEY": process.env.GELATO_API_KEY,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred" });
  }
});

app.post("/fetch-images", imageGenLimiter, async (req, res) => {
  try {
    const promptText = req.body.prompt;
    const form = new FormData();
    form.append("prompt", promptText || "photograph of a cat surfing");

    // Make a POST request to the Text to Image API
    const response = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "x-api-key": process.env.CLIPDROP_API_KEY,
        },
        responseType: "arraybuffer",
      }
    );

    // Set the response headers and send the image data
    res.set("Content-Type", "image/png");
    res.send(response.data); // Send the ArrayBuffer directly
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating image");
  }
});

app.post("/dezgo-generate-image", imageGenLimiter, async (req, res) => {
  try {
    const { prompt } = req.body;

    const formData = new FormData();
    formData.append("lora2_strength", ".7");
    formData.append("lora2", "");
    formData.append("lora1_strength", ".7");
    formData.append("prompt", prompt);
    formData.append("width", "512");
    formData.append("height", "512");
    formData.append("steps", "30");
    formData.append("sampler", "dpmpp_2m_karras");
    formData.append("model", "dreamshaper_7");
    formData.append(
      "negative_prompt",
      "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, blurry, bad anatomy, blurred, watermark, grainy, signature, cut off, draft"
    );
    formData.append("upscale", "1");
    formData.append("seed", "");
    formData.append("guidance", "7");
    formData.append("lora1", "");

    const response = await axios.post(
      "https://api.dezgo.com/text2image",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "X-Dezgo-Key": process.env.DEZGO_API_KEY,
        },
        responseType: "arraybuffer",
      }
    );

    res.set("Content-Type", "image/png");
    res.send(response.data); // Send the ArrayBuffer directly
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generating image");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

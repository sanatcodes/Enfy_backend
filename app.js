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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

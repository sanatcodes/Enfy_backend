const express = require("express");
const axios = require("axios");
const cors = require("cors");
const FormData = require("form-data");
require("dotenv").config();
const multer = require("multer");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.use(cors());

const upload = multer();
app.use(upload.none());

app.use(bodyParser.json());

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

// add rate limiting when in production
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
    if (error.response && error.response.status === 402) {
      console.log("Out of ClipDrop credits.");
      return res.status(402).send("Out of ClipDrop credits.");
    }
    res.status(500).send("Error generating image");
  }
});

// generte image from dezgo
app.post("/dezgo-generate-image", async (req, res) => {
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

app.post("/createOrder", (req, res) => {
  // Extract parameters from the request body
  const { OrderId, CustomerId, items, shippingAddress } = req.body;

  // Use the API key from the environment variables
  const apiKey = process.env.GELATO_API_KEY;

  // Define headers
  let headers = {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey,
  };

  // Set up order request
  let orderUrl = "https://order.gelatoapis.com/v4/orders";
  let orderJson = {
    orderType: "order",
    orderReferenceId: OrderId,
    customerReferenceId: CustomerId,
    currency: "USD",
    items: items,
    shipmentMethodUid: "express",
    shippingAddress: shippingAddress,
  };

  // Send order request
  request.post(
    {
      url: orderUrl,
      headers: headers,
      body: JSON.stringify(orderJson),
    },
    function (error, res, body) {
      if (error) {
        res.status(500).json({ error: "Failed to place order." });
        return;
      }
      res.json(JSON.parse(body));
    }
  );
});

app.post("/getMockup", async (req, res) => {
  const { product, imgUrl } = req.body;

  const url = "https://api.mediamodifier.com/v2/mockup/render";

  const headers = {
    api_key: process.env.MEDIA_MODIFIER_API_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let payload;

  switch (product) {
    case "t-shirt":
      payload = {
        nr: 520,
        layer_inputs: [
          {
            id: "juqu6evm8k4dtcu835p",
            data: imgUrl,
            crop: {
              x: 50,
              y: 0,
              width: 512,
              height: 512,
            },
            checked: true,
          },
          {
            id: "juqu6evngbz3cjyh7sj",
            checked: true,
            color: {
              red: 0,
              green: 0,
              blue: 0,
            },
          },
        ],
      };
      break;
    // Add cases for 'poster' and 'canvas' here...

    default:
      return res.status(400).send({ error: "Invalid product type" });
  }

  try {
    const response = await axios.post(url, payload, { headers: headers });

    if (response.status !== 200) {
      throw new Error(
        `Failed to fetch from MediaModifier: ${response.statusText}`
      );
    }

    return res.json(response.data.url);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

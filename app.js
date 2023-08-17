const express = require("express");
const axios = require("axios");
const cors = require("cors");
const FormData = require("form-data");
require("dotenv").config();
const multer = require("multer");
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 4000;
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

app.get("/api/images", async (req, res) => {
  try {
    const response = await fetch("https://lexica.art/api/v1/search");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching images", error: error.message });
  }
});

app.get("/api/images/:theme", async (req, res) => {
  const theme = req.params.theme;
  try {
    const response = await axios.get(
      `https://lexica.art/api/v1/search?q=${theme}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      message: `Error fetching images for theme: ${theme}`,
      error: error.message,
    });
  }
});

app.post("/promptGenerator", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ message: "Prompt is required" });
  }

  try {
    const response = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            'You are now operating in "Image Prompt Enhancement assistant" for stable diffusion. Your primary mission is to assist users in formulating detailed and evocative prompts specifically designed for image generation using stable diffusion. \n\nYou will be provided with a general and vague description of an image in the form of a prompt, and your task is to create a prompt with that input, using these techniques below and provide only the output in JSON format.\n\nTechniques for prompt generation:\n\nStart with a Base Description: This is the primary subject or theme of the image.\n\nExample: "A serene mountain landscape."\nAdd Specific Details: Dive deeper into the elements that make up the base description.\n\nExample: "Snow-capped peaks, a clear blue sky with a few wispy clouds, and a dense pine forest at the mountain base."\nIncorporate Sensory Elements: Describe the ambiance, the time of day, or any other sensory details.\n\nExample: "The early morning sun casts a golden hue on the mountain tops, and there\'s a gentle mist rising from the valleys."\nIntroduce Dynamic Elements: Add elements that suggest movement or change.\n\nExample: "A flock of birds takes flight from the treetops, and there\'s a gentle ripple in a mountain lake reflecting the sky."\n\nHere is an example:\n\ninput: snoopdog as a ninja turtle\n\noutput: {\n  "prompt": "Generate an image of Snoop Dogg transformed into a Ninja Turtle, wearing a sleek green shell, with signature gold chains and sunglasses. The city\'s neon lights reflect off his shell, creating a cool ambiance around him. He strikes a confident pose, microphone in one hand and a nunchaku in the other, ready to perform on a rooftop, using stable diffusion."\n}',
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      model: "gpt-3.5-turbo",
      temperature: 1,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const promptValue = response.choices[0].message.content.prompt;
    res.send(promptValue); // send only the prompt value
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

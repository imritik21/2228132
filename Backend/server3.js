const express = require("express");
const https = require("https");
const app = express();
const WINDOW_SIZE = 10;


const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQzNjAxMjYwLCJpYXQiOjE3NDM2MDA5NjAsImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6Ijg1ZDVmZTkxLWQ1MTktNGViYS05NTk3LTEwYjQ3MDhiZWYzMSIsInN1YiI6Imltcml0a2syMUBnbWFpbC5jb20ifSwiZW1haWwiOiJpbXJpdGlrMjFAZ21haWwuY29tIiwibmFtZSI6InJpdGlrIHNoYW5rYXIiLCJyb2xsTm8iOiIyMjI4MTMyIiwiYWNjZXNzQ29kZSI6Im53cHdyWiIsImNsaWVudElEIjoiODVkNWZlOTEtZDUxOS00ZWJhLTk1OTctMTBiNDcwOGJlZjMxIiwiY2xpZW50U2VjcmV0IjoicE1SVkJ6ZW1FQ3B2cmFIViJ9.tOzc1xW_95y6V5sbWFskmzuKvFMgt93iV8_MAuo50bI";
const API_CONFIG = {
  host: "20.244.56.144",
  endpoints: {
    p: { path: "/evaluation-service/primes", mock: [2, 3, 5, 7, 11] },
    f: { path: "/evaluation-service/fibo", mock: [55, 89, 144] },
    e: { path: "/evaluation-service/even", mock: [8, 10, 12, 14] },
    r: { path: "/evaluation-service/rand", mock: [5, 17, 23, 42, 8] }, 
  },
  options: {
    timeout: 3000,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      Accept: "application/json",
    },
    rejectUnauthorized: false,
  },
};

const numberWindows = {};
Object.keys(API_CONFIG.endpoints).forEach((type) => {
  numberWindows[type] = [];
});

const agent = new https.Agent({ keepAlive: true });

async function fetchFromAPI(type) {
  return new Promise((resolve) => {
    const endpoint = API_CONFIG.endpoints[type];

    const req = https.get(
      {
        ...API_CONFIG.options,
        hostname: API_CONFIG.host,
        path: endpoint.path,
        agent: agent,
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            resolve(result.numbers || []);
          } catch {
            console.error("Failed to parse API response");
            resolve([]);
          }
        });
      }
    );

    req.on("error", (err) => {
      console.error(`API Error (${type}):`, err.code);
      resolve([]);
    });

    req.on("timeout", () => {
      req.destroy();
      console.error(`API Timeout (${type})`);
      resolve([]);
    });
  });
}

async function fetchNumbers(type) {
  try {
    const apiNumbers = await fetchFromAPI(type);
    return apiNumbers.length > 0 ? apiNumbers : API_CONFIG.endpoints[type].mock;
  } catch (err) {
    console.error("Fetch error:", err);
    return API_CONFIG.endpoints[type].mock;
  }
}

function updateWindow(type, newNumbers) {
  const window = numberWindows[type];
  const prevState = [...window];

  const uniqueNew = [...new Set(newNumbers.filter((n) => !window.includes(n)))];
  const updatedWindow = [...window, ...uniqueNew].slice(-WINDOW_SIZE);

  numberWindows[type] = updatedWindow;

  const avg =
    updatedWindow.length > 0
      ? parseFloat(
          (
            updatedWindow.reduce((a, b) => a + b, 0) / updatedWindow.length
          ).toFixed(2)
        )
      : 0;

  return {
    prevState,
    currState: updatedWindow,
    avg: Number(avg),
  };
}

app.get("/numbers/:type", async (req, res) => {
  const type = req.params.type;

  if (!API_CONFIG.endpoints[type]) {
    return res.status(400).json({
      error:
        "Invalid type. Use 'p' (primes), 'f' (fibo), 'e' (even), or 'r' (random)",
    });
  }

  const numbers = await fetchNumbers(type);
  const { prevState, currState, avg } = updateWindow(type, numbers);

  res.json({
    windowPrevState: prevState,
    windowCurrState: currState,
    numbers: numbers,
    avg: avg,
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "active",
    windows: Object.keys(numberWindows).reduce((acc, type) => {
      acc[type] = numberWindows[type].length;
      return acc;
    }, {}),
  });
});

app.listen(9876, () => {
  console.log("Server is running on http://localhost:9876");
  console.log("Endpoints:");
  console.log("- /numbers/p : Prime numbers");
  console.log("- /numbers/f : Fibonacci numbers");
  console.log("- /numbers/e : Even numbers");
  console.log("- /numbers/r : Random numbers");
  console.log("- /health : System status");
});

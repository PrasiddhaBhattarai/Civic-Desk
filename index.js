import { config } from "dotenv";
config();
import { app } from "./src/app.js";
import redis from "./src/config/redis.js";

const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server listening on port, ${port}`);
});

// pass it to front_end later
const complaintCategories = {
  "Roads & Transport": [
    "potholes",
    "illegal parking",
    "accident"
  ],
  "Sanitation": [
    "garbage",
    "open drains",
    "bad smell"
  ],
  "Water Supply": [
    "no water",
    "contaminated water"
  ],
  "Power": [
    "streetlight out",
    "power cuts"
  ],
  "Health": [
    "dead animals"
  ],
  "Environment": [
    "pollution",
    "noise complaints"
  ]
};

// Civic-Desk
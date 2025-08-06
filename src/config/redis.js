import Redis from "ioredis";

// const redis = new Redis(process.env.REDIS_URL);

const redis = new Redis();


// Run a ping to verify connection
redis.ping()
    .then((result) => {
        if (result === "PONG") {
            console.log("Redis: Ping successful");
        } else {
            console.warn("Redis: Unexpected ping response:", result);
        }
    })
    .catch((err) => {
        console.error("Redis: Ping failed", err);
    });

export default redis;

const { MongoMemoryServer } = require("mongodb-memory-server");
const { execSync, spawn } = require("child_process");
const path = require("path");

async function main() {
  console.log("==============================================");
  console.log("Starting EduSankofa SMS Dev Environment");
  console.log("==============================================");
  
  try {
    // 1. Boot up in-memory MongoDB
    console.log("Starting in-memory MongoDB instance on port 27017...");
    const mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: "school-management"
      },
      binary: {
        version: "4.0.25"
      }
    });
    console.log("✔ In-memory MongoDB is running on port 27017");
    console.log(`✔ Connection URI: ${mongod.getUri()}`);

    // 2. Seed database
    console.log("\nSeeding database with demo users...");
    execSync("node scripts/seedDemoUsers.js", {
      cwd: __dirname,
      stdio: "inherit",
      env: {
        ...process.env,
        MONGODB_URI: "mongodb://localhost:27017/school-management"
      }
    });
    console.log("✔ Database seeded successfully");

    // 3. Start development servers concurrently
    console.log("\nStarting application (frontend + backend)...");
    const appProcess = spawn("npm", ["run", "dev"], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        JWT_SECRET: "12345678901234567890123456789012", // Secure 32-character secret for startup checks
        MONGODB_URI: "mongodb://localhost:27017/school-management"
      }
    });

    appProcess.on("exit", (code) => {
      console.log(`\nApplication process exited with code ${code}`);
      mongod.stop();
      process.exit(code);
    });

    process.on("SIGINT", () => {
      console.log("\nShutting down in-memory MongoDB and servers...");
      mongod.stop();
      appProcess.kill("SIGINT");
      process.exit(0);
    });

  } catch (err) {
    console.error("✖ Failed to start development environment:", err);
    process.exit(1);
  }
}

main();

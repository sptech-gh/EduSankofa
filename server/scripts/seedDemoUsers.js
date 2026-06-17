const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  // Ignore fallback issues
}

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { MongoMemoryServer } = require("mongodb-memory-server");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envFile = dotenv.parse(fs.readFileSync(path.resolve(__dirname, "../.env"), "utf8"));

const mongoose = require("mongoose");
const User = require("../models/User");

const getMongoUri = () => {
  const shellUri = String(process.env.MONGODB_URI || "").trim();
  if (shellUri && !shellUri.includes("<your-atlas-uri>") && !shellUri.includes("<") && shellUri.includes("mongodb")) {
    return shellUri;
  }

  return envFile.MONGODB_URI || "mongodb://localhost:27017/school-management";
};

const connectWithFallback = async () => {
  const primaryUri = getMongoUri();

  try {
    await mongoose.connect(primaryUri);
    return { mongoUri: primaryUri, memoryServer: null };
  } catch (err) {
    const message = String(err?.message || err || "");
    const shouldFallback = /ECONNREFUSED|ENOTFOUND|querySrv|URI must include hostname|failed to connect/i.test(message);

    if (process.env.NODE_ENV === "production" || !shouldFallback) {
      throw err;
    }

    console.warn("Primary MongoDB connection unavailable; starting temporary in-memory MongoDB for seeding...");
    const memoryServer = await MongoMemoryServer.create();
    const uri = await memoryServer.getUri();
    await mongoose.connect(uri);
    return { mongoUri: uri, memoryServer };
  }
};

const isResetPasswordsEnabled = () => {
  const args = process.argv.slice(2);
  if (args.includes("--reset-passwords")) return true;
  const envFlag = String(process.env.SEED_RESET_PASSWORDS || "").toLowerCase();
  return envFlag === "1" || envFlag === "true" || envFlag === "yes";
};

const upsertUser = async ({ name, email, role, password }, { resetPasswords }) => {
  const existing = await User.findOne({ email: String(email || "").toLowerCase().trim() });

  if (!existing) {
    const created = await User.create({
      name,
      email,
      role,
      password,
      status: "active",
    });
    return { user: created, created: true, passwordWasSet: true };
  }

  existing.name = name;
  existing.role = role;
  existing.status = existing.status || "active";

  let passwordWasSet = false;
  if (resetPasswords) {
    existing.password = password;
    passwordWasSet = true;
  }

  const saved = await existing.save();
  return { user: saved, created: false, passwordWasSet };
};

const main = async () => {
  let memoryServer = null;

  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    console.error("Refusing to seed demo users in production (NODE_ENV=production). ");
    process.exit(1);
  }

  const resetPasswords = isResetPasswordsEnabled();

  const demoUsers = [
    {
      name: "Admin User",
      email: "admin@edusankofa.edu.gh",
      role: "admin",
      password: "Admin#12345",
    },
    {
      name: "Staff User",
      email: "staff@edusankofa.edu.gh",
      role: "staff",
      password: "Staff#12345",
    },
    {
      name: "Teacher User",
      email: "teacher@edusankofa.edu.gh",
      role: "teacher",
      password: "Teacher#12345",
    },
    {
      name: "Accounts Officer",
      email: "accounts@edusankofa.edu.gh",
      role: "accounts officer",
      password: "Accounts#12345",
    },
    {
      name: "Parent User",
      email: "parent@edusankofa.edu.gh",
      role: "parent",
      password: "Parent#12345",
    },
    {
      name: "Student User",
      email: "student@edusankofa.edu.gh",
      role: "student",
      password: "Student#12345",
    },
  ];

  const { mongoUri, memoryServer: fallbackServer } = await connectWithFallback();
  memoryServer = fallbackServer;

  const results = await Promise.all(
    demoUsers.map(async (u) => {
      const result = await upsertUser(u, { resetPasswords });
      return {
        email: u.email,
        role: u.role,
        password: u.password,
        created: result.created,
        passwordWasSet: result.passwordWasSet,
      };
    })
  );

  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }

  console.log("\nSeeded demo users:\n");
  for (const r of results) {
    const status = r.created ? "CREATED" : "UPDATED";
    const pwdNote = r.passwordWasSet ? "PASSWORD_SET" : "PASSWORD_UNCHANGED";
    console.log(`${status} ${pwdNote} | ${r.role} | ${r.email} | ${r.password}`);
  }

  console.log("\nNotes:");
  console.log("- Passwords are only reset if you pass --reset-passwords or set SEED_RESET_PASSWORDS=true");
  console.log("- This seeds into the database pointed at by MONGODB_URI (or the localhost default).\n");
};

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
  }
  process.exit(1);
});

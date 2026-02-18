import fs from 'fs';
import path from 'path';

console.log("Starting test script...");

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Reading .env from ${envPath}`);

if (!fs.existsSync(envPath)) {
    console.log("❌ .env file not found!"); // Changed to log
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    console.log("Keys found:", Object.keys(env));
    process.exit(1);
}

console.log(`✅ Config loaded. URL: ${SUPABASE_URL}`);
console.log("Calling 'run-debate' function...");

const functionUrl = `${SUPABASE_URL}/functions/v1/run-debate`;

try {
    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ mode: 'auto', stream: false }), 
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log("\n✅ Debate Completed Successfully!");
    console.log(`Topic: "${data.topic}"`);
    console.log(`Winner: ${data.winner.name}`);

} catch (err) {
    console.log("\n❌ Test Failed: " + err.message); // Changed to log
    process.exit(1);
}

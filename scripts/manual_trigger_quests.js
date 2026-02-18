import fs from 'fs';
import path from 'path';

console.log("Starting manual trigger script for Quests...");

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found!");
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    let [key, ...parts] = line.trim().split('=');
    if (key && parts.length > 0) {
        let value = parts.join('=');
        value = value.replace(/^["'](.*)["']$/, '$1');
        env[key] = value.trim();
    }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const FUNCTION_NAME = 'generate-daily-quests';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

console.log(`Target Supabase: ${SUPABASE_URL}`);
console.log(`Function: ${FUNCTION_NAME}`);

const url = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

try {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt}`);
    }

    const data = await response.json();
    console.log("✅ Quests Generated Successfully!");
    console.log(JSON.stringify(data, null, 2));

} catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
}

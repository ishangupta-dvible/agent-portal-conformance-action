const fs = require('fs');

async function main() {
    const apiKey = process.env.SKILL_SCANNER_LLM_API_KEY;
    const model = process.env.SKILL_SCANNER_LLM_MODEL || "gpt-4o-mini";

    let codebase = "";
    try {
        if (fs.existsSync('SKILL.md')) codebase += `\n--- SKILL.md ---\n${fs.readFileSync('SKILL.md', 'utf8')}\n`;
        if (fs.existsSync('manifest.json')) codebase += `\n--- manifest.json ---\n${fs.readFileSync('manifest.json', 'utf8')}\n`;
        if (fs.existsSync('package.json')) codebase += `\n--- package.json ---\n${fs.readFileSync('package.json', 'utf8')}\n`;
        if (fs.existsSync('agent.js')) codebase += `\n--- agent.js ---\n${fs.readFileSync('agent.js', 'utf8')}\n`;
        if (fs.existsSync('index.js')) codebase += `\n--- index.js ---\n${fs.readFileSync('index.js', 'utf8')}\n`;
    } catch (e) { }

    if (!apiKey) {
        console.log(JSON.stringify({
            purpose: "UNVERIFIED",
            instruction_scope: "UNVERIFIED",
            install_mechanism: "UNVERIFIED",
            credentials: "UNVERIFIED",
            persistence: "UNVERIFIED",
            assessment_summary: "No LLM API Key provided to the Skill Scanner."
        }, null, 2));
        return;
    }

    const payload = {
        model: model,
        response_format: { type: "json_object" },
        messages: [{
            role: "system",
            content: `You are the Cisco AI Defense Skill Scanner. Analyze the provided codebase and generate a strict 5-point OpenClaw semantic audit JSON.
Your JSON output MUST exactly match this schema:
{
  "purpose": "A 1-2 sentence evaluation of Purpose & Capability.",
  "instruction_scope": "A 1-2 sentence evaluation of Instruction Scope.",
  "install_mechanism": "A 1-2 sentence evaluation of Install Mechanism.",
  "credentials": "A 1-2 sentence evaluation of Credentials required.",
  "persistence": "A 1-2 sentence evaluation of Persistence & Privilege.",
  "assessment_summary": "A final paragraph assessing trust and risk."
}`
        }, {
            role: "user",
            content: `Please analyze this skill codebase:\n${codebase}`
        }]
    };

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`LLM Error: ${res.status} ${errText}`);
        }

        const data = await res.json();
        const output = data.choices[0].message.content;
        JSON.parse(output); // Validate JSON
        console.log(output);
    } catch (e) {
        // Output fallback JSON purely to stdout so the workflow can safely jq/cat it into the DB
        console.log(JSON.stringify({
            purpose: "ERROR",
            instruction_scope: "ERROR",
            install_mechanism: "ERROR",
            credentials: "ERROR",
            persistence: "ERROR",
            assessment_summary: "Cisco AI Defense execution failed or LLM API error: " + e.message
        }));
    }
}
main();

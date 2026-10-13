async function testDirect() {
  console.log("Sending direct fetch to Ollama http://127.0.0.1:11434/api/chat...");
  const start = Date.now();
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.1:latest",
      messages: [
        { role: "system", content: "You are an expert CA. Answer in one sentence." },
        { role: "user", content: "What was the net profit of Apex Enterprises in FY 2022 if it was 110.8 Lakhs?" }
      ],
      stream: false
    })
  });
  console.log(`Fetch returned status ${res.status} in ${(Date.now() - start) / 1000}s`);
  const data = await res.json();
  console.log("Response:", data.message?.content);
  process.exit(0);
}

testDirect().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

import { ChatOllama } from "@langchain/ollama";

async function test() {
  console.log("Starting ChatOllama test...");
  const model = new ChatOllama({
    baseUrl: "http://localhost:11434",
    model: "llama3.1:latest",
    temperature: 0,
  });
  console.log("Invoking...");
  const res = await model.invoke("Say 'Local Model Ready' in 3 words.");
  console.log("Response:", res.content);
}

test().catch(console.error);

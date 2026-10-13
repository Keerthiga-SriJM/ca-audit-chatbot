import { ChatOllama } from "@langchain/ollama";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

async function main() {
  console.log("Creating ChatOllama...");
  const model = new ChatOllama({
    baseUrl: "http://localhost:11434",
    model: "llama3.1:latest",
    temperature: 0,
  });

  const sys = new SystemMessage(
    "You are an expert AI Chartered Accountant. The net profit of Apex Enterprises in FY 2022 was 110.8 Lakhs. Give a direct one sentence answer."
  );
  const user = new HumanMessage("What was the net profit of Apex Enterprises in FY 2022?");

  console.log("Invoking with System + Human messages...");
  const start = Date.now();
  const res = await model.invoke([sys, user]);
  console.log(`Finished in ${(Date.now() - start) / 1000}s`);
  console.log("Content:", res.content);
}

main().catch(console.error);

import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI("AIzaSyDjaWgF060ydyH3nbiJFbfZDMgpWyX4Rlc");
async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("Hello");
    console.log(result.response.text());
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
test();

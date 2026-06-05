import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Lazy-initialized Gemini client to prevent startup failure if key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Server-side AI chat router proxying to Gemini safely
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, year, syllabusFolders } = req.body;
      const ai = getGeminiClient();

      let syllabusContext = "";
      if (syllabusFolders && syllabusFolders.length > 0) {
        syllabusContext = `The user is studying the following subjects: ` + syllabusFolders.map((f: any) => `\n- ${f.name} (Files attached: ${f.files.length})`).join("");
      }

      // System instruction defining a professional, supportive focus lounge companion
      const systemInstruction = `You are an encouraging and deeply knowledgeable AI Study Assistant in the Focus Lounge. The user is a student in their "${year || "school year"}". ${syllabusContext} \nKeep answers insightful, clear, concise, and beautifully structured in markdown. Avoid fluff. Help them with study schedules, concept explanations, motivation, and quick quizzes relevant to their study level, always keeping a warm, aesthetic, lo-fi cafe vibe.`;

      const contents = [];
      if (history && Array.isArray(history)) {
        for (const h of history) {
          contents.push({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }]
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate AI response" });
    }
  });

  // Server-side AI endpoint for breaking down tasks
  app.post("/api/breakdown", async (req, res) => {
    try {
      const { taskText, year } = req.body;
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Break down the following study task into 3-4 highly actionable, bite-sized sub-tasks for a ${year || "student"}. Only return the list of items separated by newlines, do not use numbers or bullet characters. Task: ${taskText}` }]}
        ],
        config: {
          temperature: 0.4,
        },
      });

      const text = response.text || "";
      const subTasks = text.split("\n").map(t => t.replace(/^[-\*\d\.]+\s*/, '').trim()).filter(t => t.length > 0);
      res.json({ subTasks });
    } catch (error: any) {
      console.error("Gemini Breakdown API error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate breakdown" });
    }
  });

  // Server-side AI endpoint for generating exams from syllabus files
  app.post("/api/generate-exam", async (req, res) => {
    try {
      const { subject, config, files } = req.body;
      const ai = getGeminiClient();

      const parts: any[] = [];
      
      // If there are files, append them to the prompt
      for (const file of files || []) {
        // file.url contains base64 string
        if (file.url && file.url.startsWith("data:")) {
          const mimeType = file.url.split(";")[0].split(":")[1];
          const base64Data = file.url.split(",")[1];
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType
            }
          });
        }
      }

      parts.push({
        text: `You are an expert academic evaluator. Create a highly accurate, factually correct exam for the subject: "${subject}". 
        Number of questions: ${config.numberOfQuestions}. Question type: ${config.questionType}. 
        
        CRITICAL INSTRUCTIONS:
        1. If files are provided, base your questions and answers STRICTLY on the contents of the files.
        2. Ensure the correct answer is absolutely, factually correct. Do not hallucinate or guess.
        3. Double check that the index of the correct answer ('a') matches the correct option in the options array ('o').
        
        Return ONLY a JSON array of objects. Each object must have:
        "q" (the question text),
        "o" (an array of 4 options for multiple choice, or 2 for True/False, or an array with 1 empty string for short answer if applicable. For short answer we still require options array with just plausible short answer keywords),
        "a" (the 0-indexed integer of the correct option from the "o" array),
        "e" (a detailed explanation proving why the correct answer is right according to the material).
        
        Do not include markdown blocks like \`\`\`json. Return a raw JSON array.`
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts }
        ],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json"
        },
      });

      const text = response.text || "[]";
      let cleanupText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      let questions = [];
      try {
        questions = JSON.parse(cleanupText);
      } catch (e) {
        console.error("Failed to parse JSON", e, text);
        // fallback
      }
      res.json({ questions });
    } catch (error: any) {
      console.error("Gemini Generate Exam API error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate exam" });
    }
  });

  // Determine environment
  const isProd = process.env.NODE_ENV === "production";
  
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robustly resolve dist path
    let distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      distPath = path.join(__dirname, "dist");
    }
    
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Error: Page not found. The app is still building or dist/index.html is missing.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

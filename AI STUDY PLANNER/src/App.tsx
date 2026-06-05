import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Moon, 
  Sun,
  DoorOpen, 
  Sparkles, 
  LogOut, 
  Watch, 
  Play, 
  Pause, 
  RotateCcw, 
  BookOpen, 
  Plus, 
  Check, 
  Coffee, 
  Compass, 
  HelpCircle, 
  ArrowRight, 
  Volume2, 
  VolumeX, 
  Send, 
  Activity, 
  Trash, 
  GraduationCap,
  Folder,
  FileText,
  Camera,
  Upload,
  X,
  ChevronLeft,
  Paperclip,
  PlayCircle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { initAuth, googleSignIn, logout, getAccessToken } from "./lib/auth";

interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
  pomodoros?: number;
  category?: string;
  priority?: "High" | "Medium" | "Low";
  isRecurring?: boolean;
  notes?: string;
  streak?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Question {
  q: string;
  o: string[];
  a: number;
  e: string;
}

interface Subject {
  title: string;
  questions: Question[];
}

interface SyllabusFile {
  id: string;
  name: string;
  type: string;
  url?: string;
}

interface SyllabusFolder {
  id: string;
  name: string;
  files: SyllabusFile[];
}

const productivityData = [
  { name: 'Mon', completed: 4, pending: 2 },
  { name: 'Tue', completed: 3, pending: 4 },
  { name: 'Wed', completed: 6, pending: 1 },
  { name: 'Thu', completed: 5, pending: 3 },
  { name: 'Fri', completed: 7, pending: 2 },
  { name: 'Sat', completed: 2, pending: 5 },
  { name: 'Sun', completed: 5, pending: 0 },
];

export default function App() {
  // Navigation & Authentication states
  const [selectedYear, setSelectedYear] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [customYear, setCustomYear] = useState("");
  const [entered, setEntered] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [timeStr, setTimeStr] = useState("");
  
  // Dashboard states - 3 core distinct tabs
  const [activeTab, setActiveTab ] = useState<"hub" | "study" | "exam" | "ai" | "syllabus">("hub");
  const [studyView, setStudyView] = useState<"overview" | "environment">("overview");
  const [examView, setExamView] = useState<"overview" | "setup" | "loading" | "environment">("overview");
  const [examSetupConfig, setExamSetupConfig] = useState({
    subjectId: "",
    fileIds: [] as string[],
    questionType: "Multiple Choice",
    numberOfQuestions: 10,
    durationMinutes: 15
  });
  
  // Syllabus state
  const [syllabusFolders, setSyllabusFolders] = useState<SyllabusFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Theme state
  const [isDark, setIsDark] = useState(false);

  // Pomodoro states
  const [timerMode, setTimerMode] = useState<"focus" | "short" | "long">("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Sound generator states
  const [activeSound, setActiveSound] = useState<"none" | "drone" | "binaural" | "rain">("none");

  // Task state
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem("focusItems");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: "1", text: "Read research methodology paper", checked: false, priority: "High", category: "Science", pomodoros: 2 },
      { id: "2", text: "Complete algebra homework proof", checked: true, priority: "Medium", category: "Math", pomodoros: 1 },
      { id: "3", text: "Review terms for upcoming mock test", checked: false, priority: "Low", isRecurring: true, streak: 3 }
    ];
  });

  useEffect(() => {
    localStorage.setItem("focusItems", JSON.stringify(tasks));
  }, [tasks]);

  const [newTaskText, setNewTaskText] = useState("");
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [breakingDownTasks, setBreakingDownTasks] = useState<Set<string>>(new Set());
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);

  // Authentication Setup
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => setIsAuthenticated(true),
      () => setIsAuthenticated(false)
    );
    return () => unsubscribe();
  }, []);

  // Quiz states
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answersSheet, setAnswersSheet] = useState<Record<number, number>>({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [completedExamsCount, setCompletedExamsCount] = useState(0);
  const [examError, setExamError] = useState("");
  const [examTimeRemaining, setExamTimeRemaining] = useState(0);

  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatAttachments, setChatAttachments] = useState<File[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Audio synthesis references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const whiteNoiseSourceRef = useRef<AudioScheduledSourceNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Setup initial clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle Exam Countdown Timer
  useEffect(() => {
    let timer: any;
    if (examView === "environment" && selectedSubject && !quizCompleted && examTimeRemaining > 0) {
      timer = setInterval(() => {
        setExamTimeRemaining(prev => {
          if (prev <= 1) {
             setQuizCompleted(true);
             setCompletedExamsCount(c => c + 1);
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [examView, selectedSubject, quizCompleted, examTimeRemaining]);

  // Sync Pomodoro initial values when mode resets
  useEffect(() => {
    if (timerMode === "focus") setSecondsLeft(25 * 60);
    else if (timerMode === "short") setSecondsLeft(5 * 60);
    else if (timerMode === "long") setSecondsLeft(15 * 60);
    setTimerRunning(false);
  }, [timerMode]);

  // Handle active Pomodoro countdown ticker
  useEffect(() => {
    let intervalId: any = null;
    if (timerRunning && secondsLeft > 0) {
      intervalId = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0 && timerRunning) {
      setTimerRunning(false);
      // Play a quick satisfying beep in the browser securely
      try {
        const beepCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = beepCtx.createOscillator();
        const gain = beepCtx.createGain();
        osc.frequency.setValueAtTime(520, beepCtx.currentTime);
        gain.gain.setValueAtTime(0.2, beepCtx.currentTime);
        osc.connect(gain);
        gain.connect(beepCtx.destination);
        osc.start();
        osc.stop(beepCtx.currentTime + 0.5);
      } catch (e) {}
    }
    return () => clearInterval(intervalId);
  }, [timerRunning, secondsLeft]);

  // Clean-up synthesis nodes on logout/exit/unmount
  const stopAestheticAmbient = () => {
    try {
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      oscillatorsRef.current = [];

      if (whiteNoiseSourceRef.current) {
        try { whiteNoiseSourceRef.current.stop(); } catch (e) {}
        whiteNoiseSourceRef.current = null;
      }

      if (masterGainRef.current) {
        try { masterGainRef.current.disconnect(); } catch (e) {}
        masterGainRef.current = null;
      }
    } catch (e) {
      console.warn("Ignored synthesizer stop error", e);
    }
  };

  // Browser Web Audio API synthesis for active organic noise (No external assets required!)
  const handleToggleSound = (type: "none" | "drone" | "binaural" | "rain") => {
    stopAestheticAmbient();

    if (type === "none" || activeSound === type) {
      setActiveSound("none");
      return;
    }

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.connect(ctx.destination);
      masterGainRef.current = gain;

      if (type === "drone") {
        // Deep focus atmospheric low frequency filter synth
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(110, ctx.currentTime); // Chord A2

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(110.3, ctx.currentTime); // Chorus micro detune

        const filterObj = ctx.createBiquadFilter();
        filterObj.type = "lowpass";
        filterObj.frequency.setValueAtTime(150, ctx.currentTime);

        osc1.connect(filterObj);
        osc2.connect(filterObj);
        filterObj.connect(gain);

        osc1.start();
        osc2.start();
        oscillatorsRef.current = [osc1, osc2];
      } else if (type === "binaural") {
        // 130Hz Left panned, 170Hz Right panned => produces calming 40Hz delta difference
        const pannerLeft = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const pannerRight = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        const oscL = ctx.createOscillator();
        oscL.type = "sine";
        oscL.frequency.setValueAtTime(130, ctx.currentTime);

        const oscR = ctx.createOscillator();
        oscR.type = "sine";
        oscR.frequency.setValueAtTime(170, ctx.currentTime);

        if (pannerLeft && pannerRight) {
          pannerLeft.pan.setValueAtTime(-1, ctx.currentTime);
          pannerRight.pan.setValueAtTime(1, ctx.currentTime);
          oscL.connect(pannerLeft);
          pannerLeft.connect(gain);
          oscR.connect(pannerRight);
          pannerRight.connect(gain);
        } else {
          oscL.connect(gain);
          oscR.connect(gain);
        }

        oscL.start();
        oscR.start();
        oscillatorsRef.current = [oscL, oscR];
      } else if (type === "rain") {
        // Organic Cozy Rain Simulator via dynamically computed white noise
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const outputChannel = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          outputChannel[i] = Math.random() * 2 - 1;
        }

        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = noiseBuffer;
        sourceNode.loop = true;

        const filterObj = ctx.createBiquadFilter();
        filterObj.type = "bandpass";
        filterObj.frequency.setValueAtTime(550, ctx.currentTime);
        filterObj.Q.setValueAtTime(1.1, ctx.currentTime);

        sourceNode.connect(filterObj);
        filterObj.connect(gain);

        sourceNode.start();
        whiteNoiseSourceRef.current = sourceNode;
      }

      setActiveSound(type);
    } catch (e) {
      console.warn("Audio synthesis state missed on this frame. Interacted gesture needed.", e);
    }
  };

  // Entrance submit action
  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const finalYear = showOther ? customYear.trim() : selectedYear;
    if (!finalYear) return;
    
    setZooming(true);
    
    setTimeout(() => {
      setEntered(true);
      // Pre-seed chat greeting when entering
      setChatMessages([
        { 
          role: "assistant", 
          content: `Hello! Welcome to your Focus Lounge AI Companion. What study topic are we tackling today in your "${finalYear}" track? Let me know if you need customized schedules, difficult concepts simplified, or simulated mock questions!` 
        }
      ]);
    }, 1200); 
  };

  const handleSquareSelect = (year: string) => {
    setSelectedYear(year);
    setShowOther(false);
  };

  const currentYear = showOther ? customYear : selectedYear;
  const canEnter = showOther ? customYear.trim().length > 0 : selectedYear.length > 0;

  // Study tasks handlers
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setTasks([
      ...tasks,
      { id: Date.now().toString(), text: newTaskText.trim(), checked: false, priority: "Medium", pomodoros: 1, isRecurring: false }
    ]);
    setNewTaskText("");
  };

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const checked = !t.checked;
        let streak = t.streak;
        if (checked && t.isRecurring) {
          streak = (streak || 0) + 1;
        } else if (!checked && t.isRecurring) {
          streak = Math.max(0, (streak || 1) - 1);
        }
        return { ...t, checked, streak };
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setTasks(items);
  };

  const handleSaveTaskDetails = (updatedTask: TaskItem) => {
    setTasks(tasks.map(t => (t.id === updatedTask.id ? updatedTask : t)));
    setEditingTask(null);
  };

  const handleAIBreakdown = async (task: TaskItem, index: number) => {
    if (breakingDownTasks.has(task.id)) return;
    
    // Optimistically show loading state
    setBreakingDownTasks(prev => {
      const next = new Set(prev);
      next.add(task.id);
      return next;
    });

    try {
      const response = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskText: task.text, year: currentYear })
      });

      if (!response.ok) throw new Error("Failed breakdown");
      const data = await response.json();
      
      const newSubTasks = (data.subTasks || []).map((st: string, idx: number) => ({
        id: Date.now().toString() + "-" + idx,
        text: st,
        checked: false,
        priority: task.priority || "Medium",
        pomodoros: 1,
        isRecurring: false
      }));

      if (newSubTasks.length > 0) {
        setTasks(prev => {
          const newTasks = [...prev];
          // Replace the original task with the new sub-tasks
          newTasks.splice(index, 1, ...newSubTasks);
          return newTasks;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBreakingDownTasks(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const syncGoogleCalendar = async () => {
    try {
      setIsCalendarSyncing(true);
      let token = await getAccessToken();
      if (!token) {
        const authResult = await googleSignIn();
        if (authResult?.accessToken) {
          token = authResult.accessToken;
        }
      }
      if (!token) throw new Error("Could not authenticate with Google");
      
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(timeMin);
      timeMax.setDate(timeMax.getDate() + 1);

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&orderBy=startTime&singleEvents=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch calendar events");
      
      const data = await response.json();
      setCalendarEvents(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCalendarSyncing(false);
    }
  };

  // Study subjects review cards
  const studySubjects: Record<string, Subject[]> = {
    "1st Year": [
      {
        title: "Foundations of Human Logic",
        questions: [
          {
            q: "Which logical fallacy occurs when someone attacks the speaker instead of the core argument?",
            o: ["Ad Hominem", "Straw Man", "Slippery Slope", "False Dilemma"],
            a: 0,
            e: "Ad Hominem translates from Latin as 'to the person', attacking the opponent rather than addressing the substance of their claims."
          },
          {
            q: "What is the primary method of logical deduction pioneered by Aristotle?",
            o: ["The Socratic Method", "The Syllogism", "Inductive Generalization", "Hypothetical Reasoning"],
            a: 1,
            e: "Syllogism is a three-part deductive logical sequence, combining major and minor premises with a conclusion."
          }
        ]
      },
      {
        title: "Introduction to Calculus Concepts",
        questions: [
          {
            q: "What defines the mathematical limit of a function as x approaches a value c?",
            o: ["The value exactly equal to f(c)", "The tangent rate of f'(c)", "The value f(x) gets arbitrarily close to as x approaches c", "The total integrated area under f(c)"],
            a: 2,
            e: "A limit focuses strictly on the value f(x) gets close to as x approaches c, regardless of whether f(c) is actually defined."
          }
        ]
      }
    ],
    "2nd Year": [
      {
        title: "Data Structures & Algorithmic Efficiency",
        questions: [
          {
            q: "Which data structure operates strictly on a Last-In, First-Out (LIFO) memory order?",
            o: ["Queue", "Hash Table", "Binary Search Tree", "Stack"],
            a: 3,
            e: "A Stack stores items in LIFO order—similar to a pile of dishes, the last one placed is the first item extracted."
          },
          {
            q: "What is the average runtime complexity of performing a search operation in a self-balancing Binary Search Tree?",
            o: ["O(1)", "O(N)", "O(log N)", "O(N log N)"],
            a: 2,
            e: "Balanced BSTs halve the target search space at each vertical level, achieving O(log N) average query complexity."
          }
        ]
      }
    ],
    "3rd Year": [
      {
        title: "Advanced Analytical Research Methods",
        questions: [
          {
            q: "In high-fidelity statistical research, what does a p-value of less than 0.05 traditionally reject?",
            o: ["The Null Hypothesis", "The Experimental Hypothesis", "The Type I Error rate", "The Research Scope"],
            a: 0,
            e: "A p-value below 0.05 indicates statistical significance, prompting researchers to reject the Null Hypothesis of no effect."
          }
        ]
      }
    ],
    "4th Year": [
      {
        title: "Capstone Methodologies & Professional Ethics",
        questions: [
          {
            q: "What ethical principle highlights protecting participant data anonymity and enabling informed choice?",
            o: ["Benevolent Paternalism", "Epistemological Pluralism", "Informed Consent & Confidentiality", "Scientific Relativism"],
            a: 2,
            e: "Informed Consent ensures participants enter studies of their own volition with safety coordinates established."
          }
        ]
      }
    ]
  };

  // Get active subjects
  const yearKey = selectedYear || "1st Year";
  const subjectsAvailable = studySubjects[yearKey] || [
    {
      title: "Advanced Interdisciplinary Methodology",
      questions: [
        {
          q: "What research philosophy argues that knowledge is verified through sensory experience and logical analysis?",
          o: ["Phenomenology", "Positivism", "Post-Structuralism", "Hermeneutics"],
          a: 1,
          e: "Positivism holds that empirical evidence obtained from sensory observation is the primary source of objective truth."
        }
      ]
    }
  ];

  const handleStartQuiz = (subject: Subject) => {
    setSelectedSubject(subject);
    setCurrentQuestionIdx(0);
    setAnswersSheet({});
    setQuizCompleted(false);
  };

  const handleGenerateAndStartExam = async () => {
    if (!examSetupConfig.subjectId) return;

    setExamError("");
    setExamView("loading");
    document.documentElement.requestFullscreen().catch(() => {});

    const subjectObj = syllabusFolders.find(f => f.id === examSetupConfig.subjectId);
    if (!subjectObj) return;

    // Filter to selected files or all if none specifically checked (user will check them in UI, let's assume they might be empty)
    const filesToInclude = subjectObj.files.filter(f => examSetupConfig.fileIds.includes(f.id));

    try {
      const response = await fetch("/api/generate-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectObj.name,
          config: examSetupConfig,
          files: filesToInclude.length > 0 ? filesToInclude : subjectObj.files
        })
      });

      if (!response.ok) throw new Error("Failed to generate exam: " + response.statusText);
      const data = await response.json();
      
      let fetchedQuestions = data.questions || [];
      
      // Validation check
      fetchedQuestions = fetchedQuestions.filter((q: any) => 
        q.q && q.e && Array.isArray(q.o) && typeof q.a === 'number' && q.o.length > 0
      );

      if (fetchedQuestions.length === 0) {
        throw new Error("AI returned malformed or empty questions. Please try again.");
      }

      fetchedQuestions = fetchedQuestions.sort(() => Math.random() - 0.5);

      const newSubject = {
        title: subjectObj.name,
        questions: fetchedQuestions,
        durationMinutes: examSetupConfig.durationMinutes
      };

      setSelectedSubject(newSubject);
      setCurrentQuestionIdx(0);
      setAnswersSheet({});
      setQuizCompleted(false);
      setExamTimeRemaining(examSetupConfig.durationMinutes * 60);
      setExamView("environment");
    } catch (err: any) {
      console.error(err);
      setExamError(err.message || "Failed to generate exam");
      setExamView("setup");
    }
  };

  const handleOptionSelect = (optionIdx: number) => {
    if (quizCompleted) return;
    setAnswersSheet({
      ...answersSheet,
      [currentQuestionIdx]: optionIdx
    });
  };

  const handleNextQuizQuestion = () => {
    if (!selectedSubject) return;
    if (currentQuestionIdx < selectedSubject.questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      setQuizCompleted(true);
      setCompletedExamsCount(prev => prev + 1);
    }
  };

  const submitMessageToChat = async (userMessage: string) => {
    if ((!userMessage.trim() && chatAttachments.length === 0) || chatLoading) return;
    setChatInput("");
    setChatError("");

    let finalMessage = userMessage;
    if (chatAttachments.length > 0) {
      finalMessage += `\n[Attached files: ${chatAttachments.map(f => f.name).join(", ")}]`;
    }
    
    setChatAttachments([]);

    const updatedHistory = [
      ...chatMessages,
      { role: "user" as const, content: finalMessage }
    ];
    setChatMessages(updatedHistory);
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalMessage,
          history: chatMessages,
          year: currentYear,
          syllabusFolders: syllabusFolders
        })
      });

      if (!response.ok) {
        throw new Error("Unable to fetch response from study engine.");
      }

      const data = await response.json();
      setChatMessages([
        ...updatedHistory,
        { role: "assistant" as const, content: data.text || "I was unable to synthesize a study response." }
      ]);
    } catch (err: any) {
      setChatError(err?.message || "There was an unexpected connection issue.");
    } finally {
      setChatLoading(false);
    }
  };

  // AI Chat Bot prompt submission to /api/chat
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessageToChat(chatInput);
  };

  // Predefined prompts handler
  const handleInsertPrompt = (promptText: string) => {
    setChatInput(promptText);
  };

  // Custom visual text formatter for chat bubble to handle markdown formatting beautifully over cream layout
  const renderMessageContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="text-sm font-bold text-text-main mt-3 mb-1">{line.replace("### ", "")}</h4>;
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={idx} className="font-bold text-indigo-700 my-1">{line.replaceAll("**", "")}</p>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={idx} className="list-disc ml-4 my-1 text-text-muted text-xs leading-relaxed">
            {line.substring(2)}
          </li>
        );
      }
      return <p key={idx} className="text-xs leading-relaxed text-text-main my-1">{line}</p>;
    });
  };

  // Pre-seed years grid
  const yearSquares = [
    { 
      id: 1, 
      year: "1st Year", 
      emoji: "🌱", 
      desc: "Freshman milestone",
      colors: "hover:bg-amber-50 border-border-color/50", 
      activeColors: "bg-primary text-primary-text border-primary shadow-md shadow-primary/10" 
    },
    { 
      id: 2, 
      year: "2nd Year", 
      emoji: "🌿", 
      desc: "Sophomore milestone",
      colors: "hover:bg-emerald-50/50 border-border-color/50", 
      activeColors: "bg-primary text-primary-text border-primary shadow-md shadow-primary/10" 
    },
    { 
      id: 3, 
      year: "3rd Year", 
      emoji: "🔮", 
      desc: "Junior milestone",
      colors: "hover:bg-indigo-50/50 border-border-color/50", 
      activeColors: "bg-primary text-primary-text border-primary shadow-md shadow-primary/10" 
    },
    { 
      id: 4, 
      year: "4th Year", 
      emoji: "🎓", 
      desc: "Senior milestone",
      colors: "hover:bg-rose-50/50 border-border-color/50", 
      activeColors: "bg-primary text-primary-text border-primary shadow-md shadow-primary/10" 
    }
  ];

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className={`relative w-screen h-screen overflow-hidden bg-bg-base text-text-main font-sans antialiased selection:bg-bg-panel-hover selection:text-text-main`}>
      <AnimatePresence>
        {!entered && (
          <motion.div
            key="entrance"
            id="entrance-view"
            className="absolute inset-0 z-10 w-full h-full flex flex-col lg:flex-row overflow-hidden"
            animate={
              zooming
                ? { 
                    scale: 1.05, 
                    opacity: 0, 
                    filter: "blur(15px)",
                    transformOrigin: "center center"
                  }
                : { 
                    scale: 1, 
                    opacity: 1, 
                    filter: "blur(0px)" 
                  }
            }
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} 
          >
            {/* Left Panel - Immersive Ambient Cozy Room Section */}
            <div className="relative w-full lg:w-[45%] h-[30vh] lg:h-full bg-bg-panel border-b lg:border-b-0 lg:border-r border-border-color/50 flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden flex-shrink-0">
              <div className="absolute inset-0 pointer-events-none z-0">
                <img 
                  src="https://media.tenor.com/7D-dE0x9EKEAAAAC/aesthetic-room.gif"
                  alt="Cozy Study Room GIF"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/80 to-[#fdfcfb]/40" />
              </div>

              {/* Sub-header inside ambient screen */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-bg-panel flex items-center justify-center border border-border-color/40 shadow-sm">
                    <DoorOpen className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-xs font-bold tracking-widest text-accent uppercase font-mono">Focus Gate</span>
                </div>
                <div className="text-[11px] text-accent font-mono flex items-center gap-2 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Est. 2026</span>
                </div>
              </div>

              {/* Middle Section: Aesthetic Title Block */}
              <div className="relative z-10 my-auto pt-2 lg:pt-0 max-w-sm lg:max-w-md">
                <p className="text-[10px] sm:text-xs font-black tracking-widest text-indigo-650 uppercase mb-2 lg:mb-3 font-mono">
                  Welcome back
                </p>
                <h1 className="text-2xl sm:text-3.5xl lg:text-4.5xl font-serif italic text-text-main leading-tight tracking-tight">
                  A peaceful place for quiet minds and steady study progress.
                </h1>
                <p className="text-xs text-text-muted mt-2 lg:mt-4 leading-relaxed font-sans">
                  Choose your academic milestone space below to populate dynamic planners, ambient noise wave makers, and real-time review units.
                </p>
              </div>

              {/* Footer inside ambient screen */}
              <div className="relative z-10 hidden lg:flex items-center justify-between text-xs text-text-muted font-mono border-t border-border-color/30 pt-4">
                <div className="flex items-center gap-2">
                  <Watch className="w-3.5 h-3.5 text-text-muted" />
                  <span>{timeStr || "12:00 PM"} Local Time</span>
                </div>
                <div className="italic">Step in & breathe</div>
              </div>
            </div>

            {/* Right Panel - Full Screen Interactive Decision Section (Guaranteed No Scroll) */}
            <div className="relative w-full lg:w-[55%] h-[70vh] lg:h-full bg-bg-base flex flex-col justify-between p-4 sm:p-8 lg:p-12 overflow-hidden">
              {/* Header on top of decision maker */}
              <div className="hidden lg:flex justify-end items-center gap-3 text-xs text-text-muted">
                <span>Select year below</span>
                <div className="h-4 w-[1px] bg-[#ebd9c1]/50" />
                <span className="font-mono uppercase bg-bg-panel-hover px-2 py-0.5 rounded text-accent font-bold text-[10px]">v1.3.0</span>
              </div>

              {/* Main Selection Area */}
              <div className="my-auto w-full max-w-xl mx-auto space-y-4 lg:space-y-6">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl lg:text-3.5xl font-serif italic text-text-main tracking-tight">
                    Which Year are you Studying?
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted font-medium font-sans">
                    Please make a selection in the Imagination Rectangle below to configure your custom workspace.
                  </p>
                </div>

                {/* Form to submit and start */}
                <form onSubmit={handleEnter} className="space-y-4 lg:space-y-5">
                  
                  {/* Outer Imagination Rectangle */}
                  <div className="relative pt-3">
                    {/* Top-standing label tag for aesthetic depth */}
                    <div className="absolute top-0 left-6 z-30 px-3 py-0.5 bg-primary border border-[#524742] rounded-lg text-[8px] font-extrabold text-primary-text tracking-wider uppercase shadow-md font-mono">
                      IMAGINATION RECTANGLE
                    </div>

                    {/* The Grid: 4 Squares Filling the Rectangle Perfectly */}
                    <div className="grid grid-cols-2 gap-3 bg-bg-panel-hover/30 p-4 pt-8 rounded-3xl border border-border-color/40 shadow-sm">
                      {yearSquares.map((sq) => {
                        const isActive = selectedYear === sq.year && !showOther;
                        return (
                          <motion.div
                            key={sq.id}
                            whileHover={{ scale: 1.015, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            id={`square-${sq.id}`}
                            onClick={() => handleSquareSelect(sq.year)}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between text-left select-none relative overflow-hidden h-22 sm:h-26 lg:h-30 ${
                              isActive
                                ? sq.activeColors
                                : `bg-bg-panel/80 border-border-color/40 ${sq.colors}`
                            }`}
                          >
                            {/* Accent Circle for Active State */}
                            {isActive && (
                              <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-bg-panel/10 rounded-full blur-xl" />
                            )}

                            {/* Top part of Square */}
                            <div className="flex justify-between items-start">
                              <span className="text-xl sm:text-2xl">{sq.emoji}</span>
                              <span className={`text-[10px] font-bold font-mono tracking-widest ${isActive ? 'text-text-muted' : 'text-text-muted'}`}>
                                0{sq.id}
                              </span>
                            </div>

                            {/* Bottom part of Square */}
                            <div className="space-y-1">
                              <h3 className={`font-bold text-xs sm:text-sm tracking-tight leading-none ${isActive ? 'text-primary-text' : 'text-text-main'}`}>
                                {sq.year}
                              </h3>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Other Specific Entry Trigger */}
                  <div className="text-center">
                    {!showOther ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowOther(true);
                          setSelectedYear("");
                        }}
                        className="text-xs font-bold text-accent hover:text-indigo-600 transition-colors duration-200 cursor-pointer underline decoration-dotted underline-offset-4 pointer-events-auto"
                      >
                        Don&apos;t fit the milestones above? Click to specify custom level
                      </button>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-2 bg-bg-panel p-3 rounded-2xl border border-border-color/40 text-left shadow-sm"
                      >
                        <label className="block text-[10px] font-bold tracking-widest text-accent uppercase font-mono">
                          Custom Study Term/Year
                        </label>
                        <div className="gap-2 flex">
                          <input
                            type="text"
                            autoFocus
                            required
                            value={customYear}
                            onChange={(e) => setCustomYear(e.target.value)}
                            placeholder="e.g. Master's, PhD, Bootcamp"
                            className="flex-1 bg-bg-base border border-border-color/60 rounded-xl px-4 py-2 text-text-main outline-none focus:ring-1 focus:ring-indigo-500 transition font-semibold text-xs"
                            disabled={zooming}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowOther(false);
                              setCustomYear("");
                            }}
                            className="px-3 py-2 rounded-xl bg-bg-panel-hover text-xs font-extrabold text-text-muted hover:text-stone-950 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Submission and Portal Launch */}
                  <button
                    type="submit"
                    disabled={zooming || !canEnter}
                    className="w-full bg-primary hover:bg-primary-hover text-primary-text font-bold py-3 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-primary/10"
                  >
                    <span className="text-xs tracking-widest font-extrabold uppercase font-mono">Step Inside Focus Lounge</span>
                  </button>

                </form>
              </div>

              {/* Bottom Decoration */}
              <div className="pt-4 border-t border-border-color/20 flex items-center justify-between text-[11px] text-text-muted font-semibold font-mono">
                <span className="flex items-center gap-1.5 font-bold text-text-muted">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  Your aesthetic sanctuary is prepared
                </span>
                <span>Study Planner Suite © 2026</span>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Focus Lounge Interior Dashboard */}
      <AnimatePresence>
        {entered && (
          <motion.div
            key="room"
            id="lounge-interior"
            className="absolute inset-0 bg-bg-base text-text-main flex flex-col h-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Unified Aesthetic Header */}
            <header className="bg-bg-panel/95 backdrop-blur-xl border-b border-border-color relative z-50 px-4 sm:px-6 py-3.5 shadow-sm">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                
                {/* Brand Title Coordinates */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md">
                    <BookOpen className="w-4 h-4 text-primary-text" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xs font-black tracking-widest text-primary uppercase font-mono">Focus Lounge</h1>
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    </div>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mt-0.5 font-mono">
                      Active Tier : {currentYear}
                    </p>
                  </div>
                </div>

                {/* Back to Hub Button (only if not in Hub) */}
                {activeTab !== "hub" && (
                  <button
                    onClick={() => setActiveTab("hub")}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider cursor-pointer bg-bg-panel-hover text-text-main border border-border-color shadow-sm hover:shadow-md transition-all"
                  >
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    Back to Hub
                  </button>
                )}

                {/* Status & Options */}
                <div className="flex items-center gap-3 justify-end sm:justify-start">
                  <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-text-muted font-mono font-medium">
                    <Watch className="w-3 h-3 opacity-60" />
                    <span>{timeStr || "12:00 PM"}</span>
                  </div>
                  
                  {/* Theme Toggle */}
                  <button 
                    onClick={() => setIsDark(!isDark)}
                    className="p-2 rounded-lg bg-bg-base border border-border-color hover:bg-bg-panel-hover transition cursor-pointer text-text-main"
                    title="Toggle Theme"
                  >
                    {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>

                  <button 
                    onClick={() => {
                      stopAestheticAmbient();
                      setEntered(false);
                      setZooming(false);
                      setSelectedYear("");
                      setCustomYear("");
                      setActiveTab("hub");
                    }}
                    className="text-[10px] uppercase tracking-wider font-extrabold text-text-main transition cursor-pointer px-3 py-2 rounded-lg bg-bg-base hover:bg-bg-panel-hover border border-border-color flex items-center gap-1.5 shadow-sm"
                  >
                    <LogOut className="w-3 h-3" />
                    Exit
                  </button>
                </div>

              </div>
            </header>

            {/* Main Interactive Screen Segment */}
            <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:py-8 overflow-hidden flex flex-col justify-between">
              
              <AnimatePresence mode="wait">
                
                {/* 0. HUB TAB component */}
                {activeTab === "hub" && (
                  <motion.div
                    key="hub"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 w-full flex flex-col justify-center items-center py-10 overflow-y-auto"
                  >
                    <div className="max-w-4xl w-full">
                      <div className="text-center mb-10">
                        <h2 className="text-3xl lg:text-4xl font-serif text-text-main italic mb-2">Welcome to your Hub</h2>
                        <p className="text-text-muted font-sans text-sm">Select a module to continue your session.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                        <div 
                          onClick={() => setActiveTab("syllabus")}
                          className="bg-bg-panel hover:bg-bg-panel-hover border border-border-color p-6 rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col items-center text-center group"
                        >
                          <div className="w-16 h-16 bg-bg-base rounded-2xl flex items-center justify-center mb-4 border border-border-color group-hover:scale-110 transition-transform">
                            <BookOpen className="w-8 h-8 text-emerald-500" />
                          </div>
                          <h3 className="text-xl font-serif italic text-text-main mb-2">Syllabus</h3>
                          <p className="text-xs text-text-muted">Manage your subjects and syllabuses.</p>
                        </div>
                        
                        <div 
                          onClick={() => setActiveTab("study")}
                          className="bg-bg-panel hover:bg-bg-panel-hover border border-border-color p-6 rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col items-center text-center group"
                        >
                          <div className="w-16 h-16 bg-bg-base rounded-2xl flex items-center justify-center mb-4 border border-border-color group-hover:scale-110 transition-transform">
                            <Coffee className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-xl font-serif italic text-text-main mb-2">Study Suite</h3>
                          <p className="text-xs text-text-muted">Focus timer, ambient noise, and daily planner.</p>
                        </div>

                        <div 
                          onClick={() => setActiveTab("exam")}
                          className="bg-bg-panel hover:bg-bg-panel-hover border border-border-color p-6 rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col items-center text-center group"
                        >
                          <div className="w-16 h-16 bg-bg-base rounded-2xl flex items-center justify-center mb-4 border border-border-color group-hover:scale-110 transition-transform">
                            <GraduationCap className="w-8 h-8 text-accent" />
                          </div>
                          <h3 className="text-xl font-serif italic text-text-main mb-2">Exam Room</h3>
                          <p className="text-xs text-text-muted">Mock tests and interactive quizzes.</p>
                        </div>

                        <div 
                          onClick={() => setActiveTab("ai")}
                          className="bg-bg-panel hover:bg-bg-panel-hover border border-border-color p-6 rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col items-center text-center group"
                        >
                          <div className="w-16 h-16 bg-bg-base rounded-2xl flex items-center justify-center mb-4 border border-border-color group-hover:scale-110 transition-transform">
                            <Activity className="w-8 h-8 text-indigo-500" />
                          </div>
                          <h3 className="text-xl font-serif italic text-text-main mb-2">AI Chat Bot</h3>
                          <p className="text-xs text-text-muted">Get personalized help and explanations.</p>
                        </div>

                      </div>

                      {/* Badges & Achievements Section */}
                      <div className="mt-12">
                        <div className="flex items-center gap-3 mb-6">
                          <h3 className="text-xl font-serif italic text-text-main">Achievements & Badges</h3>
                          <span className="text-xs font-mono font-bold tracking-widest uppercase text-text-muted">({completedExamsCount} Exams Completed)</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          
                          {/* First Exam Badge */}
                          <div className={`p-5 rounded-3xl border flex flex-col items-center text-center transition-all duration-500 ${completedExamsCount >= 1 ? 'bg-amber-50 border-amber-200/50 shadow-sm' : 'bg-bg-base/50 border-dashed border-border-color/50 opacity-40 grayscale blur-[1px]'}`}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-white shadow-sm border border-amber-100">
                              <span className="text-2xl drop-shadow-sm">🌱</span>
                            </div>
                            <span className="text-sm font-bold text-text-main mb-1">Scholar Sprig</span>
                            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Complete 1 Exam</span>
                          </div>

                          {/* 5 Exams Badge */}
                          <div className={`p-5 rounded-3xl border flex flex-col items-center text-center transition-all duration-500 ${completedExamsCount >= 5 ? 'bg-blue-50 border-blue-200/50 shadow-sm' : 'bg-bg-base/50 border-dashed border-border-color/50 opacity-40 grayscale blur-[1px]'}`}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-white shadow-sm border border-blue-100">
                              <span className="text-2xl drop-shadow-sm">📖</span>
                            </div>
                            <span className="text-sm font-bold text-text-main mb-1">Steadfast Student</span>
                            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Complete 5 Exams</span>
                          </div>

                          {/* 10 Exams Badge */}
                          <div className={`p-5 rounded-3xl border flex flex-col items-center text-center transition-all duration-500 ${completedExamsCount >= 10 ? 'bg-purple-50 border-purple-200/50 shadow-sm' : 'bg-bg-base/50 border-dashed border-border-color/50 opacity-40 grayscale blur-[1px]'}`}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-white shadow-sm border border-purple-100">
                              <span className="text-2xl drop-shadow-sm">🧠</span>
                            </div>
                            <span className="text-sm font-bold text-text-main mb-1">Mental Master</span>
                            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Complete 10 Exams</span>
                          </div>

                          {/* 25 Exams Badge */}
                          <div className={`p-5 rounded-3xl border flex flex-col items-center text-center transition-all duration-500 ${completedExamsCount >= 25 ? 'bg-orange-50 border-orange-200/50 shadow-sm shadow-orange-100' : 'bg-bg-base/50 border-dashed border-border-color/50 opacity-40 grayscale blur-[1px]'}`}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-white shadow-sm border border-orange-100">
                              <span className="text-2xl drop-shadow-sm">👑</span>
                            </div>
                            <span className="text-sm font-bold text-text-main mb-1">Exam Sovereign</span>
                            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Complete 25 Exams</span>
                          </div>

                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 1. STUDY TAB component */}
                {activeTab === "study" && (
                  <motion.div
                    key="study"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 w-full flex flex-col items-center overflow-y-auto"
                  >
                    {studyView === "overview" && (
                      <div className="w-full max-w-3xl py-10 flex flex-col items-center">
                        {/* Clock Widget */}
                        <div className="mb-10 text-center">
                          <h2 className="text-text-muted text-sm font-mono uppercase tracking-widest font-bold mb-2">Current System Time</h2>
                          <div className="text-6xl md:text-7xl font-sans tracking-tight font-black text-text-main flex items-center justify-center gap-2">
                            {timeStr || "12:00 PM"}
                          </div>
                        </div>

                        {/* Productivity Chart */}
                        <div className="w-full bg-bg-panel border border-border-color rounded-3xl p-6 md:p-8 shadow-sm mb-8">
                          <div className="flex justify-between items-end mb-6">
                            <div>
                              <span className="text-[10px] font-black tracking-widest text-accent uppercase font-mono">Analytics</span>
                              <h3 className="text-xl font-serif italic text-text-main mt-1 flex items-center gap-2">
                                7-Day Productivity Trends
                                <button className="text-text-muted hover:text-accent transition-colors cursor-pointer" title="Video Explanation">
                                  <PlayCircle className="w-5 h-5" />
                                </button>
                              </h3>
                            </div>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={productivityData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                <RechartsTooltip 
                                  contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)', borderRadius: '0.75rem', fontSize: '12px', color: 'var(--text-main)' }}
                                  itemStyle={{ fontWeight: 600, color: 'var(--text-main)' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Line type="monotone" dataKey="completed" name="Completed Tasks" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="pending" name="Pending Tasks" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Schedule Table */}
                        <div className="w-full bg-bg-panel border border-border-color rounded-3xl p-6 md:p-8 shadow-sm mb-8">
                          <div className="flex justify-between items-end mb-6">
                            <div>
                              <span className="text-[10px] font-black tracking-widest text-accent uppercase font-mono">Module 01</span>
                              <h3 className="text-xl font-serif italic text-text-main mt-1">Today's Schedule</h3>
                            </div>
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead>
                                <tr className="border-b border-border-color text-text-muted text-xs uppercase font-mono tracking-wider">
                                  <th className="pb-3 pr-4 font-semibold">Time</th>
                                  <th className="pb-3 pr-4 font-semibold">Activity</th>
                                  <th className="pb-3 pr-4 font-semibold">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-color)]/50 text-text-main">
                                <tr>
                                  <td className="py-4 pr-4 font-mono text-xs">09:00 AM</td>
                                  <td className="py-4 pr-4 font-medium">Deep Work Session</td>
                                  <td className="py-4 pr-4"><span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] uppercase font-bold rounded">Completed</span></td>
                                </tr>
                                <tr>
                                  <td className="py-4 pr-4 font-mono text-xs">11:30 AM</td>
                                  <td className="py-4 pr-4 font-medium">Concept Review</td>
                                  <td className="py-4 pr-4"><span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] uppercase font-bold rounded">Pending</span></td>
                                </tr>
                                <tr>
                                  <td className="py-4 pr-4 font-mono text-xs">02:00 PM</td>
                                  <td className="py-4 pr-4 font-medium">Mock Exam Preparation</td>
                                  <td className="py-4 pr-4"><span className="px-2 py-1 bg-bg-base text-text-muted text-[10px] uppercase font-bold rounded">Scheduled</span></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {syllabusFolders.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-border-color/30">
                              <span className="text-[9px] font-black tracking-widest text-text-muted uppercase font-mono mb-2 block">Available Study Material</span>
                              <div className="flex flex-wrap gap-2">
                                {syllabusFolders.map((sf, idx) => (
                                  <button 
                                    key={idx} 
                                    onClick={() => {
                                      setActiveTab("syllabus");
                                      setSelectedFolderId(sf.id);
                                    }}
                                    className="flex items-center gap-2 bg-bg-panel hover:bg-bg-panel-hover border border-border-color px-3 py-1.5 rounded-lg text-xs font-semibold text-text-main cursor-pointer transition shadow-sm"
                                  >
                                    <BookOpen className="w-3 h-3 text-accent" />
                                    {sf.name}
                                    <span className="opacity-50 text-[10px] ml-1">({sf.files.length})</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Enter Environment Button */}
                        <button
                          onClick={() => setStudyView("environment")}
                          className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-3 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md w-full sm:w-auto"
                        >
                          <span className="text-xs tracking-widest font-extrabold uppercase font-mono">Enter Study Environment</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {studyView === "environment" && (
                      <div className="w-full flex-1 flex flex-col h-full">
                        <div className="flex items-center mb-4">
                          <button
                            onClick={() => setStudyView("overview")}
                            className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main transition uppercase tracking-wider bg-bg-panel hover:bg-bg-panel-hover px-3 py-1.5 rounded-lg border border-border-color"
                          >
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            Back to Overview
                          </button>
                        </div>
                        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pb-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Grid: Circular Pomodoro & Ambient Frequency Generator */}
                            <div className="flex flex-col justify-between gap-6 bg-bg-panel border border-border-color/40 p-6 rounded-3xl shadow-sm">
                      
                      {/* Section header */}
                      <div>
                        <span className="text-[9px] font-black tracking-widest text-accent uppercase font-mono">Module 01 / Study Suite</span>
                        <h2 className="text-lg font-serif italic text-text-main mt-1">Sleek Quiet Focus Timer</h2>
                      </div>

                      {/* Circular Aesthetic Countdown Timer */}
                      <div className="flex flex-col items-center justify-center my-auto py-2">
                        <div className="relative w-48 h-48 flex items-center justify-center">
                          
                          {/* Radial track background */}
                          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                            <circle
                              cx="96"
                              cy="96"
                              r="88"
                              className="stroke-stone-100 fill-none"
                              strokeWidth="4"
                            />
                            <circle
                              cx="96"
                              cy="96"
                              r="88"
                              className="stroke-[#453c38] fill-none transition-all duration-300"
                              strokeWidth="5"
                              strokeDasharray={2 * Math.PI * 88}
                              strokeDashoffset={2 * Math.PI * 88 * (1 - secondsLeft / (timerMode === "focus" ? 25 * 60 : timerMode === "short" ? 5 * 60 : 15 * 60))}
                            />
                          </svg>

                          {/* Numeric state */}
                          <div className="text-center z-10">
                            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-text-main block font-mono">
                              {Math.floor(secondsLeft / 60).toString().padStart(2, "0")}
                              <span className="animate-pulse">:</span>
                              {(secondsLeft % 60).toString().padStart(2, "0")}
                            </span>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-text-muted font-mono">
                              {timerMode === "focus" ? "Studying State" : "Rest Period"}
                            </span>
                          </div>

                        </div>

                        {/* Mode selectors */}
                        <div className="flex gap-1.5 mt-5 bg-bg-panel-hover/30 p-1 rounded-xl border border-border-color/30">
                          <button
                            onClick={() => setTimerMode("focus")}
                            className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition ${
                              timerMode === "focus" ? "bg-primary text-primary-text" : "text-text-muted hover:text-text-main"
                            }`}
                          >
                            Focus (25m)
                          </button>
                          <button
                            onClick={() => setTimerMode("short")}
                            className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition ${
                              timerMode === "short" ? "bg-primary text-primary-text" : "text-text-muted hover:text-text-main"
                            }`}
                          >
                            Short Break
                          </button>
                          <button
                            onClick={() => setTimerMode("long")}
                            className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition ${
                              timerMode === "long" ? "bg-primary text-primary-text" : "text-text-muted hover:text-text-main"
                            }`}
                          >
                            Long Break
                          </button>
                        </div>

                        {/* Interactive toggle block */}
                        <div className="flex items-center gap-3 mt-4">
                          <button
                            onClick={() => setTimerRunning(!timerRunning)}
                            className="bg-primary hover:bg-primary-hover text-primary-text p-2.5 rounded-full shadow transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                          >
                            {timerRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                          </button>
                          <button
                            onClick={() => {
                              setTimerRunning(false);
                              if (timerMode === "focus") setSecondsLeft(25 * 60);
                              else if (timerMode === "short") setSecondsLeft(5 * 60);
                              else if (timerMode === "long") setSecondsLeft(15 * 60);
                            }}
                            className="bg-bg-panel-hover hover:bg-bg-panel-hover text-text-muted p-2.5 rounded-full transition-all flex items-center justify-center cursor-pointer"
                            title="Reset Timer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>

                      </div>

                      {/* Browser-Generated Ambient Drone Mixer */}
                      <div className="border-t border-border-color/30 pt-4 bg-bg-base/80 p-4 rounded-2xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-bold tracking-widest text-accent uppercase font-mono">Atmospheric focus frequencies</span>
                          {activeSound !== "none" ? (
                            <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold tracking-wider font-mono">
                              <Volume2 className="w-3 h-3 animate-bounce" /> ACTIVE
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] text-text-muted font-bold tracking-wider font-mono">
                              <VolumeX className="w-3 h-3" /> MUTED
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleToggleSound("drone")}
                            className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide border transition-all ${
                              activeSound === "drone"
                                ? "bg-primary text-primary-text border-primary"
                                : "bg-bg-panel text-text-muted border-border-color/40 hover:border-border-color"
                            }`}
                          >
                            Cosmic Drone
                          </button>
                          <button
                            onClick={() => handleToggleSound("binaural")}
                            className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide border transition-all ${
                              activeSound === "binaural"
                                ? "bg-primary text-primary-text border-primary"
                                : "bg-bg-panel text-text-muted border-border-color/40 hover:border-border-color"
                            }`}
                          >
                            Binaural 40Hz
                          </button>
                          <button
                            onClick={() => handleToggleSound("rain")}
                            className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wide border transition-all ${
                              activeSound === "rain"
                                ? "bg-primary text-primary-text border-primary"
                                : "bg-bg-panel text-text-muted border-border-color/40 hover:border-border-color"
                            }`}
                          >
                            Rainy Noise
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* Middle Grid: Active Session Task Planner */}
                    <div className="flex flex-col justify-between overflow-hidden shadow-sm bg-bg-panel border border-border-color/40 p-6 rounded-3xl">
                      
                      <div className="space-y-4 flex-1 flex flex-col min-h-[300px] lg:overflow-hidden overflow-visible">
                        
                        {/* Section Header */}
                        <div className="flex justify-between items-center pb-2 border-b border-border-color/30">
                          <div>
                            <span className="text-[9px] font-black tracking-widest text-accent uppercase font-mono">Active planner board</span>
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-serif italic text-text-main mt-1">Daily Study Agenda</h2>
                              <button
                                onClick={syncGoogleCalendar}
                                disabled={isCalendarSyncing}
                                className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-0.5 rounded cursor-pointer hover:bg-indigo-500/20 transition disabled:opacity-50"
                              >
                                {isCalendarSyncing ? "Syncing..." : "Sync GMT+8"}
                              </button>
                            </div>
                          </div>
                          <span className="text-[10px] text-accent uppercase tracking-widest font-mono bg-bg-panel px-2 py-0.5 rounded border border-border-color/40 font-bold">
                            {tasks.filter(t => t.checked).length} / {tasks.length} Done
                          </span>
                        </div>

                        {/* Scrollable Tasks list */}
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[380px]">
                          {tasks.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-center space-y-2">
                              <p className="text-text-muted text-xs font-semibold">No planner objectives left. Add goals below!</p>
                            </div>
                          ) : (
                            <DragDropContext onDragEnd={handleDragEnd}>
                              <Droppable droppableId="tasks-list">
                                {(provided) => (
                                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 pb-10">
                                    <AnimatePresence initial={false}>
                                      {tasks.map((task, index) => (
                                        // @ts-expect-error type incompatibility with DraggableProps and React key mapping
                                        <Draggable key={task.id} draggableId={task.id} index={index}>
                                          {(provided, snapshot) => (
                                            <motion.div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              {...provided.dragHandleProps}
                                              initial={{ opacity: 0, x: -5 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              exit={{ opacity: 0, x: 5 }}
                                              className={`flex flex-col p-3.5 rounded-2xl border transition-all ${snapshot.isDragging ? "shadow-lg bg-bg-panel z-50 border-accent" : task.checked ? "bg-bg-base/40 border-border-color/30 text-text-muted" : "bg-bg-panel/80 border-border-color/30 text-text-main"}`}
                                              style={{ ...provided.draggableProps.style }}
                                            >
                                              <div className="flex items-center justify-between group">
                                                <div className="flex items-center gap-3 flex-1">
                                                  <div 
                                                    onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id); }}
                                                    className="cursor-pointer"
                                                  >
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all relative ${
                                                      task.checked
                                                        ? "bg-primary border-primary text-primary-text"
                                                        : "border-[#cbd5e1] bg-bg-panel hover:border-primary"
                                                    }`}>
                                                      <AnimatePresence>
                                                        {task.checked && (
                                                          <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            exit={{ scale: 0 }}
                                                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                          >
                                                            <Check className="w-3 h-3 text-primary-text stroke-[3px]" />
                                                          </motion.div>
                                                        )}
                                                      </AnimatePresence>
                                                      {task.checked && (
                                                        <motion.div
                                                          className="absolute inset-0 rounded bg-primary"
                                                          initial={{ scale: 1, opacity: 0.8 }}
                                                          animate={{ scale: 2.5, opacity: 0 }}
                                                          transition={{ duration: 0.4, ease: "easeOut" }}
                                                        />
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div 
                                                    className="flex-1 cursor-pointer flex flex-col gap-1"
                                                    onClick={() => setEditingTask(task)}
                                                  >
                                                    <span className={`text-xs font-semibold tracking-wide leading-tight flex items-center gap-2 ${task.checked ? "line-through opacity-60" : ""}`}>
                                                      {task.text}
                                                      {task.pomodoros && task.pomodoros > 0 && <span className="text-[10px] tracking-widest bg-transparent">{"🔴".repeat(task.pomodoros)}</span>}
                                                    </span>
                                                    {(task.category || task.priority || task.isRecurring || task.streak) && (
                                                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                        {task.priority && (
                                                          <span className={`text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${
                                                            task.priority === "High" ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                                                            task.priority === "Medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                                                            "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                                          }`}>
                                                            {task.priority}
                                                          </span>
                                                        )}
                                                        {task.category && (
                                                          <span className="text-[8px] uppercase tracking-widest font-bold bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded">
                                                            {task.category}
                                                          </span>
                                                        )}
                                                        {task.isRecurring && (
                                                          <span className="text-[8px] uppercase tracking-widest font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                            ↻ Daily {task.streak && task.streak > 0 && `(🔥 ${task.streak})`}
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                                  {!task.checked && (
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); handleAIBreakdown(task, index); }}
                                                      disabled={breakingDownTasks.has(task.id)}
                                                      title="Generate AI sub-tasks"
                                                      className="text-indigo-400 hover:text-indigo-500 p-1 rounded-lg transition disabled:opacity-50"
                                                    >
                                                      <Sparkles className={`w-3.5 h-3.5 ${breakingDownTasks.has(task.id) ? "animate-spin" : ""}`} />
                                                    </button>
                                                  )}
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                                    className="text-text-muted hover:text-rose-500 p-1 rounded-lg transition"
                                                  >
                                                    <Trash className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            </motion.div>
                                          )}
                                        </Draggable>
                                      ))}
                                    </AnimatePresence>
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </DragDropContext>
                          )}
                          
                          {calendarEvents.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-border-color/30 space-y-2">
                              <span className="text-[10px] font-black tracking-widest text-indigo-500/80 uppercase font-mono">Real-World Schedule</span>
                              {calendarEvents.map((ev, idx) => {
                                const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : null;
                                const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : null;
                                const formatTime = (d: Date | null) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                
                                return (
                                  <div key={idx} className="flex gap-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl items-center text-indigo-900/80">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                    <div className="flex-1 flex flex-col justify-center overflow-hidden">
                                      <span className="text-xs font-semibold truncate text-[#111]">{ev.summary}</span>
                                      <span className="text-[10px] opacity-80 mt-0.5">{start && end ? `${formatTime(start)} - ${formatTime(end)}` : 'All Day'}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Add task bar input */}
                      <form onSubmit={handleAddTask} className="mt-4 pt-4 border-t border-border-color/30 flex gap-2">
                        <input
                          type="text"
                          required
                          value={newTaskText}
                          onChange={(e) => setNewTaskText(e.target.value)}
                          placeholder="Add a new custom study goal (e.g. revise biochemistry lecture notes)..."
                          className="flex-1 bg-bg-base border border-border-color/50 rounded-xl px-4 py-2.5 text-xs text-[#2c2621] outline-none focus:ring-1 focus:ring-indigo-500 transition placeholder-stone-400 font-medium"
                        />
                        <button
                          type="submit"
                          className="bg-primary hover:bg-primary-hover text-primary-text px-4 py-2.5 rounded-xl transition text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer flex-shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add</span>
                        </button>
                      </form>

                    </div>
                    </div>
                    
                    {/* Right Grid: Mini AI Chat -> Full width bottom chat */}
                    <div className="w-full bg-bg-panel border border-border-color/40 p-6 rounded-3xl flex flex-col min-h-[400px] flex-shrink-0 shadow-sm">
                      <div className="flex justify-between items-center pb-2 border-b border-border-color/30 mb-4">
                        <div>
                          <span className="text-[9px] font-black tracking-widest text-accent uppercase font-mono">Resource Help</span>
                          <h2 className="text-lg font-serif italic text-text-main mt-1">Study Chat</h2>
                        </div>
                        <Sparkles className="w-5 h-5 text-accent" />
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 flex flex-col">
                        {chatMessages.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                            <HelpCircle className="w-8 h-8 mb-2" />
                            <p className="text-xs font-semibold">Need help with current resources?</p>
                            <p className="text-[10px]">Just ask the AI companion.</p>
                          </div>
                        )}
                        {chatMessages.map((msg, index) => {
                          const isUser = msg.role === "user";
                          return (
                            <div key={index} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                              <span className="text-[9px] text-text-muted mb-1 px-1">{isUser ? "You" : "AI Assistant"}</span>
                              <div className={`p-2.5 text-[11px] rounded-xl max-w-[90%] ${
                                isUser ? "bg-primary text-primary-text rounded-tr-sm" : "bg-bg-base/80 border border-border-color/40 text-text-main rounded-tl-sm"
                              }`}>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              </div>
                            </div>
                          );
                        })}
                        {chatLoading && (
                          <div className="flex flex-col items-start">
                            <div className="p-2.5 text-[11px] rounded-xl bg-bg-base/80 border border-border-color/40 rounded-tl-sm animate-pulse">
                              <span className="opacity-50">...</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleChatSubmit} className="pt-3 border-t border-border-color/30 flex flex-col gap-2">
                        {syllabusFolders.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              const msg = `According to our Syllabus resources (${syllabusFolders.map(s => s.name).join(", ")}), can you give me a summary/advice on this subject?`;
                              submitMessageToChat(msg);
                            }}
                            className="w-full text-left text-[10px] font-semibold bg-bg-base hover:bg-bg-panel-hover border border-border-color/40 rounded-md px-2 py-1.5 transition text-text-muted cursor-pointer"
                          >
                            + Ask from Resources
                          </button>
                        )}
                        {chatAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {chatAttachments.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-1 bg-bg-base border border-border-color/50 px-2 py-1 rounded text-[10px] text-text-muted">
                                <Paperclip className="w-3 h-3" />
                                <span className="truncate max-w-[100px]">{file.name}</span>
                                <button type="button" onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500 ml-1 cursor-pointer">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => chatFileInputRef.current?.click()}
                            className="bg-bg-base border border-border-color/50 hover:bg-bg-panel-hover text-text-muted px-3 py-2 rounded-xl transition cursor-pointer flex-shrink-0 flex items-center justify-center"
                            title="Attach File"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <input type="file" multiple className="hidden" ref={chatFileInputRef} onChange={(e) => { if(e.target.files) setChatAttachments([...chatAttachments, ...Array.from(e.target.files)]); e.target.value = ''; }} />
                          <input
                            type="text"
                            required={chatAttachments.length === 0}
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={chatAttachments.length > 0 ? "Add message context..." : "Ask a question..."}
                            className="flex-1 bg-bg-base border border-border-color/50 rounded-xl px-3 py-2 text-xs text-text-main outline-none focus:ring-1 focus:ring-accent transition placeholder-stone-400 font-medium"
                          />
                          <button
                            type="submit"
                            disabled={chatLoading}
                            className="bg-primary hover:bg-primary-hover text-primary-text px-3 py-2 rounded-xl transition text-xs flex items-center justify-center cursor-pointer flex-shrink-0 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </form>
                    </div>

                  </div>
                </div>
              )}

            </motion.div>
          )}

          {/* 2. EXAM TAB component */}
                {activeTab === "exam" && (
                  <motion.div
                    key="exam"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 w-full flex flex-col items-center overflow-y-auto"
                  >
                    {examView === "overview" && (
                      <div className="w-full max-w-3xl py-10 flex flex-col items-center">
                        {/* Clock Widget */}
                        <div className="mb-10 text-center">
                          <h2 className="text-text-muted text-sm font-mono uppercase tracking-widest font-bold mb-2">Current System Time</h2>
                          <div className="text-6xl md:text-7xl font-sans tracking-tight font-black text-text-main flex items-center justify-center gap-2">
                            {timeStr || "12:00 PM"}
                          </div>
                        </div>

                        {/* Schedule Wrapper */}
                        <div className="w-full bg-bg-panel border border-border-color rounded-3xl p-6 md:p-8 shadow-sm mb-8">
                          <div className="flex justify-between items-end mb-6">
                            <div>
                              <span className="text-[10px] font-black tracking-widest text-accent uppercase font-mono">Module 02</span>
                              <h3 className="text-xl font-serif italic text-text-main mt-1">Generated Exam Prep</h3>
                            </div>
                          </div>
                          
                          <p className="text-sm text-text-muted mb-6">
                            Configure a custom mock exam generated from your uploaded syllabus files and subjects to test your readiness.
                          </p>

                          {syllabusFolders.length === 0 ? (
                            <div className="py-6 border border-dashed border-border-color rounded-2xl flex flex-col items-center justify-center bg-bg-base/50">
                              <BookOpen className="w-6 h-6 opacity-30 mb-2" />
                              <span className="text-xs font-mono tracking-widest text-text-muted uppercase">No Subjects Found</span>
                              <button 
                                onClick={() => setActiveTab("syllabus")}
                                className="mt-4 text-xs font-bold text-accent hover:underline cursor-pointer"
                              >
                                + Add in Syllabus Tab
                              </button>
                            </div>
                          ) : (
                            <div>
                              <span className="text-[9px] font-black tracking-widest text-text-muted uppercase font-mono mb-2 block">Attached Curriculum</span>
                              <div className="flex flex-wrap gap-2">
                                {syllabusFolders.map((sf, idx) => (
                                  <button 
                                    key={idx} 
                                    onClick={() => {
                                      setActiveTab("syllabus");
                                      setSelectedFolderId(sf.id);
                                    }}
                                    className="flex items-center gap-2 bg-bg-panel hover:bg-bg-panel-hover border border-border-color px-3 py-1.5 rounded-lg text-xs font-semibold text-text-main cursor-pointer transition shadow-sm"
                                  >
                                    <BookOpen className="w-3 h-3 text-accent" />
                                    {sf.name} <span className="text-text-muted text-[10px] ml-1">({sf.files.length})</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Enter Exam Environment Button */}
                        <button
                          onClick={() => {
                            setExamView("setup");
                          }}
                          className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-3 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md w-full sm:w-auto"
                        >
                          <span className="text-xs tracking-widest font-extrabold uppercase font-mono">Enter Exam Mode</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {examView === "setup" && (
                      <div className="w-full max-w-2xl py-10 flex flex-col items-stretch">
                        <div className="flex items-center gap-4 mb-4">
                          <button
                            onClick={() => setExamView("overview")}
                            className="bg-bg-panel border border-border-color p-2 rounded-xl text-text-muted hover:text-text-main transition shadow-sm"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h2 className="text-2xl font-serif italic text-text-main">Configure Exam</h2>
                            <p className="text-xs text-text-muted font-mono uppercase tracking-widest mt-1">Select topics and setup</p>
                          </div>
                        </div>

                        {examError && (
                          <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold flex items-center gap-3">
                            <AlertCircle className="w-5 h-5" />
                            {examError}
                          </div>
                        )}

                        {syllabusFolders.length === 0 ? (
                          <div className="bg-bg-panel border border-border-color rounded-3xl p-10 text-center flex flex-col items-center shadow-sm">
                            <BookOpen className="w-12 h-12 text-accent/50 mb-4" />
                            <h3 className="text-lg font-bold text-text-main mb-2">No Subjects Found</h3>
                            <p className="text-sm text-text-muted mb-6 max-w-md">You need to create a subject and upload files in the Syllabus section to generate an exam.</p>
                            <button
                              onClick={() => setActiveTab("syllabus")}
                              className="bg-accent text-white px-6 py-3 rounded-xl font-bold text-sm"
                            >
                              Go to Syllabus
                            </button>
                          </div>
                        ) : (
                          <div className="bg-bg-panel border border-border-color rounded-3xl p-6 shadow-sm space-y-6">
                            
                            {/* Subject Selection */}
                            <div>
                              <label className="block text-xs font-bold font-mono tracking-widest uppercase text-text-muted mb-3">Target Subject</label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {syllabusFolders.map(folder => (
                                  <button
                                    key={folder.id}
                                    onClick={() => {
                                      setExamSetupConfig(prev => ({ ...prev, subjectId: folder.id, fileIds: [] }));
                                    }}
                                    className={`p-3 rounded-xl border text-sm font-semibold transition-all text-left truncate ${examSetupConfig.subjectId === folder.id ? "bg-primary border-primary text-primary-text shadow-sm" : "bg-bg-base border-border-color text-text-main hover:border-accent/40"}`}
                                  >
                                    {folder.name}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Files Selection */}
                            {examSetupConfig.subjectId && (() => {
                              const selectedFolder = syllabusFolders.find(f => f.id === examSetupConfig.subjectId);
                              if (!selectedFolder || selectedFolder.files.length === 0) {
                                return (
                                  <div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                    No files found in this subject. Generating exam from general knowledge only. Add files in Syllabus for contextual exams.
                                  </div>
                                );
                              }
                              return (
                                <div>
                                  <label className="block text-xs font-bold font-mono tracking-widest uppercase text-text-muted mb-3">Include Material</label>
                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {selectedFolder.files.map(file => (
                                      <label key={file.id} className="flex items-center gap-3 p-3 rounded-xl border border-border-color bg-bg-base cursor-pointer hover:bg-bg-panel-hover transition">
                                        <input
                                          type="checkbox"
                                          checked={examSetupConfig.fileIds.includes(file.id)}
                                          onChange={(e) => {
                                            setExamSetupConfig(prev => {
                                              const fd = prev.fileIds.includes(file.id) 
                                                ? prev.fileIds.filter(id => id !== file.id)
                                                : [...prev.fileIds, file.id];
                                              return { ...prev, fileIds: fd };
                                            });
                                          }}
                                          className="w-4 h-4 rounded text-accent focus:ring-accent"
                                        />
                                        <div className="flex flex-col flex-1 truncate">
                                          <span className="text-sm font-semibold text-text-main truncate">{file.name}</span>
                                          <span className="text-[10px] text-text-muted font-mono uppercase">{file.type.split('/')[1] || "Document"}</span>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-border-color/30">
                              <div>
                                <label className="block text-xs font-bold font-mono tracking-widest uppercase text-text-muted mb-2">Question Type</label>
                                <select 
                                  value={examSetupConfig.questionType}
                                  onChange={e => setExamSetupConfig(prev => ({...prev, questionType: e.target.value}))}
                                  className="w-full bg-bg-base border border-border-color rounded-xl p-3 text-sm text-text-main focus:outline-none focus:border-accent"
                                >
                                  <option>Multiple Choice</option>
                                  <option>True / False</option>
                                  <option>Short Answers</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-bold font-mono tracking-widest uppercase text-text-muted mb-2">Question Count</label>
                                <input 
                                  type="number"
                                  min="1"
                                  max="30"
                                  value={examSetupConfig.numberOfQuestions}
                                  onChange={e => setExamSetupConfig(prev => ({...prev, numberOfQuestions: parseInt(e.target.value) || 5}))}
                                  className="w-full bg-bg-base border border-border-color rounded-xl p-3 text-sm text-text-main focus:outline-none focus:border-accent"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold font-mono tracking-widest uppercase text-text-muted mb-2">Duration (Mins)</label>
                                <input 
                                  type="number"
                                  min="1"
                                  max="120"
                                  value={examSetupConfig.durationMinutes}
                                  onChange={e => setExamSetupConfig(prev => ({...prev, durationMinutes: parseInt(e.target.value) || 15}))}
                                  className="w-full bg-bg-base border border-border-color rounded-xl p-3 text-sm text-text-main focus:outline-none focus:border-accent"
                                />
                              </div>
                            </div>
                            
                            <div className="pt-6">
                              <button
                               disabled={!examSetupConfig.subjectId}
                               onClick={handleGenerateAndStartExam}
                               className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-text font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                              >
                                <Sparkles className="w-5 h-5" /> Generate Exam & Enter
                              </button>
                            </div>

                          </div>
                        )}
                      </div>
                    )}

                    {examView === "loading" && (
                      <div className="w-full flex-1 flex flex-col items-center justify-center p-10 h-full">
                        <motion.div
                          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="w-20 h-20 mb-8 rounded-3xl bg-bg-panel border border-border-color shadow-sm flex items-center justify-center"
                        >
                          <GraduationCap className="w-10 h-10 text-accent" />
                        </motion.div>
                        <h2 className="text-2xl font-serif italic text-text-main mb-2">Entering Exam Mode...</h2>
                        <p className="text-sm font-mono text-text-muted mt-2 tracking-widest">
                          INITIALIZING FULL SCREEN & SECURE ENVIRONMENT
                        </p>
                        <div className="w-64 h-1 bg-bg-panel mt-6 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: "0%" }}
                             animate={{ width: "100%" }}
                             transition={{ duration: 2.2, ease: "easeInOut" }}
                             className="h-full bg-accent"
                           />
                        </div>
                      </div>
                    )}

                    {examView === "environment" && (
                      <div className="flex-1 flex flex-col w-full h-full">
                        <div className="flex items-center mb-4">
                          <button
                            onClick={() => {
                              try { 
                                if (document.fullscreenElement) {
                                  document.exitFullscreen(); 
                                }
                              } catch (e) {}
                              setExamView("overview");
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main transition uppercase tracking-wider bg-bg-panel hover:bg-bg-panel-hover px-3 py-1.5 rounded-lg border border-border-color"
                          >
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                            Exit Exam Mode
                          </button>
                        </div>
                        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch overflow-y-auto pb-4">
                    
                    {/* Active Exam Details */}
                    <div className="w-full lg:w-[35%] bg-bg-panel border border-border-color/40 p-6 rounded-3xl flex flex-col gap-4 shadow-sm">
                      
                      <div>
                        <span className="text-[9px] font-black tracking-widest text-accent uppercase font-mono">Live Session</span>
                        <h2 className="text-lg font-serif italic text-text-main mt-1">Generated Exam</h2>
                        <p className="text-[11px] text-text-muted mt-2 font-medium">
                          You are currently in exam mode. 
                        </p>
                      </div>

                      {selectedSubject && (
                        <div className="w-full p-4 rounded-2xl border transition-all text-left flex flex-col gap-1 bg-primary border-primary text-primary-text shadow mt-2">
                          <div className="flex justify-between items-center w-full">
                            <span className="text-[9.5px] font-mono tracking-widest font-black uppercase text-text-muted">
                              Active Subject
                            </span>
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                          <h3 className="text-sm font-bold tracking-tight mt-1 text-primary-text">{selectedSubject.title}</h3>
                          <p className="text-[10px] uppercase font-bold tracking-wider font-mono text-text-muted">
                            {selectedSubject.questions.length} questions • {examSetupConfig.durationMinutes} minutes
                          </p>
                          
                          <div className="w-full mt-3 pt-3 border-t border-primary/20">
                            <div className="flex justify-between text-[10px] font-mono font-bold uppercase mb-1.5">
                              <span className="text-text-muted">Time Remaining</span>
                              <span className="text-primary-text">{Math.floor(examTimeRemaining / 60)}:{(examTimeRemaining % 60).toString().padStart(2, '0')}</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary-text transition-all duration-1000" 
                                style={{ width: `${(examTimeRemaining / (examSetupConfig.durationMinutes * 60)) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {syllabusFolders.length > 0 && (
                        <div className="mt-2 pt-4 border-t border-border-color/30">
                          <span className="text-[9px] font-black tracking-widest text-text-muted uppercase font-mono mb-2 block">Attached Curriculum</span>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {syllabusFolders.map((sf, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-bg-base/40 border border-border-color/30 p-2.5 rounded-xl">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-text-main truncate max-w-[120px]">{sf.name}</span>
                                  <span className="text-[9px] font-mono text-text-muted">{sf.files.length} uploads</span>
                                </div>
                                <BookOpen className="w-3.5 h-3.5 text-text-muted/50" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Active Question Simulator */}
                    <div className="flex-1 bg-bg-panel border border-border-color/40 p-6 rounded-3xl flex flex-col justify-between shadow-sm overflow-hidden">
                      
                      {!selectedSubject ? (
                        <div className="flex-1 flex flex-col justify-center items-center text-center p-8 space-y-4">
                          <div className="w-12 h-12 rounded-full bg-[#ebd9c1]/20 flex items-center justify-center border border-border-color/40">
                            <HelpCircle className="w-6 h-6 text-accent" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider font-mono">No Topic Selected</h3>
                            <p className="text-xs text-text-muted max-w-xs mx-auto mt-2 leading-relaxed font-medium">
                              Choose one of the preparation topics on the left sidebar to activate the dynamic mock exam simulation.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col justify-between h-full">
                          
                          {/* Block header */}
                          <div className="flex justify-between items-center pb-3 border-b border-border-color/30 mb-4 shrink-0">
                            <div>
                              <span className="text-[9px] font-mono tracking-widest font-black text-accent uppercase">Interactive Screen Console</span>
                              <h3 className="text-sm font-serif italic text-text-main mt-1">{selectedSubject.title}</h3>
                            </div>
                            <span className="text-[10px] text-text-main tracking-wider font-mono font-bold bg-bg-base border border-border-color/40 px-2 py-0.5 rounded">
                              Question {currentQuestionIdx + 1} / {selectedSubject.questions.length}
                            </span>
                          </div>

                          {/* Progress slider bar */}
                          <div className="w-full bg-[#f3ede0] h-1 rounded-full mb-6 overflow-hidden shrink-0">
                            <div 
                              className="bg-primary h-full transition-all duration-300" 
                              style={{ width: `${((currentQuestionIdx) / selectedSubject.questions.length) * 100}%` }}
                            />
                          </div>

                          {/* Current question body */}
                          {!quizCompleted ? (
                            <div className="flex-1 overflow-hidden relative">
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={currentQuestionIdx}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 }}
                                  transition={{ duration: 0.3 }}
                                  className="h-full flex flex-col justify-center gap-6 overflow-y-auto"
                                >
                                  <h4 className="text-sm sm:text-lg font-bold text-text-main tracking-tight leading-relaxed">
                                    {selectedSubject.questions[currentQuestionIdx].q}
                                  </h4>

                                  <div className="grid grid-cols-1 gap-2.5">
                                    {selectedSubject.questions[currentQuestionIdx].o.map((option, oIdx) => {
                                      const isChosen = answersSheet[currentQuestionIdx] === oIdx;
                                      return (
                                        <button
                                          key={oIdx}
                                          onClick={() => handleOptionSelect(oIdx)}
                                          className={`p-4 rounded-xl border text-sm text-left transition-all flex items-center gap-3 cursor-pointer ${
                                            isChosen
                                              ? "bg-primary/5 border-primary text-text-main font-semibold shadow-sm"
                                              : "bg-bg-panel border-border-color/50 text-text-muted hover:border-[#8c7864] hover:bg-bg-base"
                                          }`}
                                        >
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] font-bold shrink-0 ${
                                            isChosen ? "bg-primary border-primary text-primary-text" : "border-stone-300 text-text-muted"
                                          }`}>
                                            {String.fromCharCode(64 + oIdx + 1)}
                                          </div>
                                          <span className="leading-snug">{option}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              </AnimatePresence>
                            </div>
                          ) : (
                            /* Evaluated Score Card */
                            <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4 py-6">
                              <span className="text-3xl">🏅</span>
                              <div>
                                <h3 className="text-sm font-bold text-text-main tracking-widest uppercase font-mono mb-1">Knowledge Track Complete</h3>
                                <p className="text-xs text-text-muted font-medium">Here are your evaluated study metrics:</p>
                              </div>

                              <div className="bg-bg-base border border-border-color/60 px-8 py-5 rounded-3xl text-center">
                                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-accent block">
                                  {Object.keys(answersSheet).filter(
                                    (qKey) => answersSheet[Number(qKey)] === selectedSubject.questions[Number(qKey)].a
                                  ).length} / {selectedSubject.questions.length}
                                </span>
                                <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block mt-1 font-mono">Correct Answers</span>
                              </div>

                              <div className="w-full text-left mt-6 max-h-96 overflow-y-auto space-y-4 pr-2">
                                {selectedSubject.questions.filter((q, idx) => answersSheet[idx] !== q.a).length === 0 ? (
                                  <div className="text-center p-6 text-emerald-600 font-bold text-sm bg-emerald-500/10 rounded-2xl">
                                    Perfect Score! No missed questions to review.
                                  </div>
                                ) : (
                                  <>
                                    <h4 className="text-sm font-bold text-text-main mb-2">Corrections Review</h4>
                                    {selectedSubject.questions.map((q, idx) => {
                                      const ans = answersSheet[idx];
                                      const isCorrect = ans === q.a;
                                      
                                      if (isCorrect) return null;

                                      return (
                                        <div key={idx} className="bg-bg-base border border-border-color/50 p-4 rounded-2xl">
                                          <p className="text-sm font-bold text-text-main mb-2 tracking-tight">{idx + 1}. {q.q}</p>
                                          <div className={`text-xs font-mono font-bold uppercase mb-2 text-rose-600`}>
                                            Incorrect
                                          </div>
                                          <div className="space-y-1 mb-3">
                                            <div className="text-xs text-text-muted">
                                              <span className="font-semibold text-text-main">Your Answer:</span> {q.o[ans] || "No answer"}
                                            </div>
                                            <div className="text-xs text-text-muted">
                                              <span className="font-semibold text-text-main">Correct Answer:</span> {q.o[q.a]}
                                            </div>
                                          </div>
                                          <div className="text-[11px] leading-relaxed text-text-muted bg-primary/5 p-3 rounded-xl border border-primary/10">
                                            <span className="font-bold text-accent block mb-1 uppercase tracking-widest text-[9px]">Explanation</span>
                                            {q.e}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>

                              <div className="flex gap-4 items-center pt-4">
                                <button
                                  onClick={() => window.print()}
                                  className="px-5 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                                >
                                  <Download className="w-4 h-4" /> Save as PDF
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedSubject(null);
                                  }}
                                  className="px-5 py-2.5 rounded-xl bg-bg-panel-hover border border-stone-200 text-xs font-bold text-text-muted hover:text-text-main transition uppercase tracking-wider font-mono cursor-pointer"
                                >
                                  Finish & Return
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Control Footer */}
                          {!quizCompleted && (
                            <div className="mt-6 pt-4 border-t border-border-color/30 flex justify-end">
                              <button
                                onClick={handleNextQuizQuestion}
                                disabled={answersSheet[currentQuestionIdx] === undefined}
                                className="bg-primary hover:bg-primary-hover text-primary-text font-bold px-5 py-2.5 rounded-xl transition text-xs uppercase tracking-wider disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer font-mono"
                              >
                                <span>{currentQuestionIdx === selectedSubject.questions.length - 1 ? "Complete Review" : "Next Segment"}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                        </div>
                      )}

                    </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 3. SYLLABUS TAB component */}
                {activeTab === "syllabus" && (
                  <motion.div
                    key="syllabus"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 w-full flex flex-col items-center overflow-y-auto px-4"
                  >
                    <div className="w-full max-w-4xl py-10 flex flex-col items-stretch">
                      {selectedFolderId === null ? (
                        <>
                          <div className="mb-10 text-center">
                            <h2 className="text-3xl lg:text-4xl font-serif text-text-main italic mb-2">Subject & Syllabus</h2>
                            <p className="text-text-muted font-sans text-sm">Manage your curriculum and study goals.</p>
                          </div>

                          <div className="flex gap-2 mb-8 max-w-lg mx-auto w-full">
                            <input 
                              type="text" 
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newFolderName.trim()) {
                                  setSyllabusFolders([...syllabusFolders, { id: Date.now().toString(), name: newFolderName.trim(), files: [] }]);
                                  setNewFolderName("");
                                }
                              }}
                              placeholder="Enter subject name (e.g. Mathematics)"
                              className="flex-1 bg-bg-panel border border-border-color rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-text-main placeholder-text-muted"
                            />
                            <button
                              onClick={() => {
                                if (newFolderName.trim()) {
                                  setSyllabusFolders([...syllabusFolders, { id: Date.now().toString(), name: newFolderName.trim(), files: [] }]);
                                  setNewFolderName("");
                                }
                              }}
                              disabled={!newFolderName.trim()}
                              className="bg-accent hover:bg-opacity-90 disabled:opacity-50 text-white rounded-xl px-6 py-3 font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" /> Create
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {syllabusFolders.map(folder => (
                              <div 
                                key={folder.id}
                                onClick={() => setSelectedFolderId(folder.id)}
                                className="bg-bg-panel border border-border-color rounded-2xl p-5 hover:border-accent/40 cursor-pointer transition group shadow-sm hover:shadow-md"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                                    <Folder className="w-6 h-6 fill-current" />
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setSyllabusFolders(syllabusFolders.filter(f => f.id !== folder.id)) }} className="text-text-muted hover:text-red-500 p-1 transition">
                                    <Trash className="w-4 h-4" />
                                  </button>
                                </div>
                                <h3 className="text-lg font-bold text-text-main truncate mt-2">{folder.name}</h3>
                                <p className="text-[10px] text-text-muted mt-1 font-mono uppercase tracking-widest font-semibold">{folder.files.length} ITEMS</p>
                              </div>
                            ))}
                            {syllabusFolders.length === 0 && (
                              <div className="col-span-full py-12 text-center text-text-muted border-2 border-dashed border-border-color rounded-3xl bg-bg-panel/50 flex flex-col items-center">
                                <Folder className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium text-text-main">No subjects added yet.</p>
                                <p className="text-xs opacity-70 mt-1 max-w-sm">Create your first subject folder to start establishing a unified syllabus.</p>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        (() => {
                          const folder = syllabusFolders.find(f => f.id === selectedFolderId);
                          if (!folder) {
                            setSelectedFolderId(null);
                            return null;
                          }
                          return (
                            <div className="w-full flex flex-col">
                              <button 
                                onClick={() => setSelectedFolderId(null)}
                                className="self-start flex items-center gap-2 text-xs font-bold font-mono tracking-widest uppercase text-text-muted hover:text-text-main transition mb-6 px-3 py-2 bg-bg-panel rounded-lg border border-border-color cursor-pointer hover:bg-bg-panel-hover"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" /> Back to Subjects
                              </button>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center">
                                    <Folder className="w-6 h-6 fill-current" />
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-serif text-text-main font-semibold leading-none mb-1">{folder.name}</h2>
                                    <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">{folder.files.length} ITEMS</p>
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="bg-bg-panel hover:bg-bg-panel-hover border border-border-color text-text-main p-2.5 rounded-xl transition flex text-xs font-bold items-center gap-2 cursor-pointer"
                                  >
                                    <Camera className="w-4 h-4 text-accent" /> <span className="hidden sm:inline">Camera</span>
                                  </button>
                                  <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-bg-panel hover:bg-bg-panel-hover border border-border-color text-text-main p-2.5 rounded-xl transition flex text-xs font-bold items-center gap-2 cursor-pointer"
                                  >
                                    <Upload className="w-4 h-4 text-accent" /> <span className="hidden sm:inline">Upload PDF/Img</span>
                                  </button>
                                </div>
                              </div>

                              <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                accept="application/pdf,image/*" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const url = event.target?.result as string;
                                    setSyllabusFolders(prev => prev.map(f => f.id === folder.id ? {...f, files: [...f.files, { id: Date.now().toString(), name: file.name, type: file.type, url }]} : f));
                                  };
                                  reader.readAsDataURL(file);
                                  e.target.value = "";
                                }} 
                              />
                              <input 
                                type="file" 
                                className="hidden" 
                                ref={cameraInputRef} 
                                accept="image/*" 
                                capture="environment" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const url = event.target?.result as string;
                                    setSyllabusFolders(prev => prev.map(f => f.id === folder.id ? {...f, files: [...f.files, { id: Date.now().toString(), name: file.name, type: file.type, url }]} : f));
                                  };
                                  reader.readAsDataURL(file);
                                  e.target.value = "";
                                }} 
                              />

                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {folder.files.map(file => (
                                  <div key={file.id} className="bg-bg-panel border border-border-color rounded-2xl overflow-hidden shadow-sm group relative">
                                    <button 
                                      onClick={() => setSyllabusFolders(prev => prev.map(f => f.id === folder.id ? {...f, files: f.files.filter(fi => fi.id !== file.id)} : f))}
                                      className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition z-10 hover:bg-red-500 cursor-pointer"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>

                                    <div className="aspect-square bg-bg-base flex items-center justify-center overflow-hidden border-b border-border-color">
                                      {file.type.startsWith('image/') && file.url ? (
                                        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <FileText className="w-12 h-12 text-text-muted/50" />
                                      )}
                                    </div>
                                    <div className="p-3">
                                      <p className="text-xs font-semibold text-text-main truncate" title={file.name}>{file.name}</p>
                                      <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest mt-1">{(file.type || 'unknown').split('/')[0]}</p>
                                    </div>
                                  </div>
                                ))}
                                {folder.files.length === 0 && (
                                  <div className="col-span-full py-16 text-center bg-bg-panel/50 border-2 border-dashed border-border-color rounded-3xl flex flex-col items-center">
                                    <Upload className="w-10 h-10 mb-3 opacity-20 text-text-main" />
                                    <p className="text-sm font-medium text-text-main">This folder is empty</p>
                                    <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">Upload PDF handouts, snap photos of your physical syllabus, or add study materials.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 4. AI CHAT BOT TAB component */}
                {activeTab === "ai" && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch overflow-hidden pb-4"
                  >
                    
                    {/* Left chat assistance guidelines */}
                    <div className="lg:col-span-4 bg-[#fbf9f6] border border-border-color/40 p-6 rounded-3xl hidden lg:flex flex-col justify-between overflow-y-auto shadow-2xs">
                      
                      <div className="space-y-4">
                        <div>
                          <span className="text-[9px] font-black tracking-widest text-accent uppercase font-mono">Module 03 / AI Companion</span>
                          <h2 className="text-lg font-serif italic text-text-main mt-1">Your Lounge Mentor</h2>
                          <p className="text-[11px] text-text-muted mt-1 font-medium leading-relaxed">
                            A highly intelligent assistant tailored to study patterns for your specific milestone, helping you explain tough concepts or test logical assumptions.
                          </p>
                        </div>

                        {/* Quick Prompts Suggestions */}
                        <div className="space-y-2 pt-2">
                          <span className="text-[9px] font-bold tracking-widest text-text-muted uppercase font-mono">Suggested starting cues</span>
                          
                          {syllabusFolders.length > 0 && (
                            <button
                              onClick={() => submitMessageToChat(`According to our Syllabus resources (${syllabusFolders.map(s => s.name).join(", ")}), can you give me a summary/advice on this subject?`)}
                              className="w-full bg-bg-panel hover:bg-[#faf6ee] border border-border-color/40 p-3 rounded-xl text-left text-[11px] font-semibold leading-tight text-accent transition"
                            >
                              "📚 Ask AI about my uploaded Syllabus resources"
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleInsertPrompt(`🎯 Formulate a robust 5-step daily study breakdown for a "${currentYear}" layout.`)}
                            className="w-full bg-bg-panel hover:bg-[#faf6ee] border border-border-color/40 p-3 rounded-xl text-left text-[11px] font-semibold leading-tight text-text-muted transition"
                          >
                            "🎯 Formulate a 5-step study scheduler for my level"
                          </button>
                          <button
                            onClick={() => handleInsertPrompt(`🎓 What are some optimal workflow methods to master material for "${currentYear}" milestones?`)}
                            className="w-full bg-bg-panel hover:bg-[#faf6ee] border border-border-color/40 p-3 rounded-xl text-left text-[11px] font-semibold leading-tight text-text-muted transition"
                          >
                            "🎓 Explain best material study guidelines"
                          </button>
                          <button
                            onClick={() => handleInsertPrompt("🔮 Fast quiz: present me a random tricky academic deduction question to solve.")}
                            className="w-full bg-bg-panel hover:bg-[#faf6ee] border border-border-color/40 p-3 rounded-xl text-left text-[11px] font-semibold leading-tight text-text-muted transition"
                          >
                            "🔮 Fast quiz: test me on logical puzzle concepts"
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-border-color/40 pt-4 flex items-center gap-2 text-[10px] text-text-muted font-mono">
                        <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        <span>Connected to Gemini 3.5 Flash securely</span>
                      </div>

                    </div>

                    {/* Chat engine console */}
                    <div className="lg:col-span-8 bg-bg-panel border border-border-color/40 p-6 rounded-3xl flex flex-col justify-between overflow-hidden shadow-sm">
                      
                      {/* Active messages timeline */}
                      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pl-1 mb-4">
                        {chatMessages.map((msg, index) => {
                          const isUser = msg.role === "user";
                          return (
                            <div
                              key={index}
                              className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-2.5`}
                            >
                              {!isUser && (
                                <div className="w-7 h-7 rounded-lg bg-[#ebd9c1]/30 border border-border-color/40 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-3xs">
                                  ☕
                                </div>
                              )}
                              <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed border ${
                                isUser
                                  ? "bg-primary border-transparent text-[#faf8f5] rounded-tr-sm shadow-sm"
                                  : "bg-bg-base/80 border-border-color/40 text-stone-850 rounded-tl-sm shadow-sm"
                              }`}>
                                {isUser ? (
                                  <p className="whitespace-pre-wrap">{msg.content}</p>
                                ) : (
                                  <div className="space-y-1">{renderMessageContent(msg.content)}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Loading pulse state */}
                        {chatLoading && (
                          <div className="flex justify-start items-start gap-2.5 animate-pulse">
                            <div className="w-7 h-7 rounded-lg bg-bg-panel-hover flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                              ⌛
                            </div>
                            <div className="bg-[#fbf9f6] border border-border-color/40 text-text-muted rounded-2xl rounded-tl-sm p-4 text-xs font-mono">
                              Studying prompt parameters...
                            </div>
                          </div>
                        )}

                        {/* Error logging */}
                        {chatError && (
                          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium font-mono">
                            ⚠️ {chatError}
                          </div>
                        )}
                      </div>

                      {/* Chat Attachments */}
                      {chatAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pb-2">
                          {chatAttachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-1 bg-bg-base border border-border-color/50 px-2 py-1 rounded text-[10px] text-text-muted">
                              <Paperclip className="w-3 h-3" />
                              <span className="truncate max-w-[100px]">{file.name}</span>
                              <button type="button" onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500 ml-1 cursor-pointer">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Main chat post form input */}
                      <form onSubmit={handleChatSubmit} className="flex gap-2 bg-bg-base p-1.5 rounded-2xl border border-border-color/55 flex-shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => chatFileInputRef.current?.click()}
                          className="bg-bg-panel hover:bg-bg-panel-hover text-text-muted p-2 rounded-xl transition cursor-pointer flex-shrink-0 flex items-center justify-center ml-1"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <input type="file" multiple className="hidden" ref={chatFileInputRef} onChange={(e) => { if(e.target.files) setChatAttachments([...chatAttachments, ...Array.from(e.target.files)]); e.target.value = ''; }} />
                        <input
                          type="text"
                          required={chatAttachments.length === 0}
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={chatAttachments.length > 0 ? "Add message context..." : `Ask Assistant anything related to study planning or your "${currentYear}" topics...`}
                          className="flex-1 bg-transparent px-2 py-3 text-xs text-text-main outline-none placeholder-stone-400 font-semibold"
                          disabled={chatLoading}
                        />
                        <button
                          type="submit"
                          disabled={chatLoading}
                          className="bg-primary hover:bg-primary-hover text-primary-text p-3 rounded-xl transition duration-150 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center flex-shrink-0"
                        >
                          <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </form>

                    </div>

                  </motion.div>
                )}

              </AnimatePresence>

              {/* Task Details Modal */}
              <AnimatePresence>
                {editingTask && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="bg-bg-panel border border-border-color rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-serif italic text-text-main">Task Details</h3>
                        <button onClick={() => setEditingTask(null)} className="text-text-muted hover:text-text-main">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1">Task Title</label>
                          <input 
                            type="text" 
                            value={editingTask.text} 
                            onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} 
                            className="w-full bg-bg-base border border-border-color/50 rounded-xl px-4 py-2.5 text-xs text-text-main outline-none focus:ring-1 focus:ring-accent transition font-medium"
                          />
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1">Priority</label>
                            <select 
                              value={editingTask.priority || "Medium"}
                              onChange={e => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                              className="w-full bg-bg-base border border-border-color/50 rounded-xl px-4 py-2.5 text-xs text-text-main outline-none focus:ring-1 focus:ring-accent transition font-medium appearance-none"
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1">Category</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Math, Coding"
                              value={editingTask.category || ""} 
                              onChange={e => setEditingTask({ ...editingTask, category: e.target.value })} 
                              className="w-full bg-bg-base border border-border-color/50 rounded-xl px-4 py-2.5 text-xs text-text-main outline-none focus:ring-1 focus:ring-accent transition font-medium"
                            />
                          </div>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div className="flex-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1">Pomodoros</label>
                            <input 
                              type="number" 
                              min="0"
                              max="10"
                              value={editingTask.pomodoros || 0} 
                              onChange={e => setEditingTask({ ...editingTask, pomodoros: parseInt(e.target.value) || 0 })} 
                              className="w-full bg-bg-base border border-border-color/50 rounded-xl px-4 py-2.5 text-xs text-text-main outline-none focus:ring-1 focus:ring-accent transition font-medium"
                            />
                          </div>
                          <div className="flex-1 flex items-center gap-2 mt-4">
                            <input 
                              type="checkbox" 
                              id="isRecurring"
                              checked={editingTask.isRecurring || false} 
                              onChange={e => setEditingTask({ ...editingTask, isRecurring: e.target.checked })} 
                              className="w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="isRecurring" className="text-xs font-bold uppercase tracking-widest text-text-muted cursor-pointer">Daily Recurring</label>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-1">Notes / Sub-tasks</label>
                          <textarea 
                            value={editingTask.notes || ""} 
                            onChange={e => setEditingTask({ ...editingTask, notes: e.target.value })} 
                            placeholder="Add sub-tasks, external links, or specific notes..."
                            className="w-full bg-bg-base border border-border-color/50 rounded-xl px-4 py-2.5 text-xs text-text-main outline-none focus:ring-1 focus:ring-accent transition font-medium min-h-[100px] resize-none"
                          />
                        </div>
                        <button 
                          onClick={() => handleSaveTaskDetails(editingTask)}
                          className="mt-2 w-full bg-primary hover:bg-primary-hover text-primary-text px-4 py-3 rounded-xl transition text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Save Details
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Minimal outer aesthetics footer tracker */}
              <div className="pt-3 border-t border-border-color/20 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] text-text-muted font-mono gap-2 mt-2 font-semibold">
                <span className="flex items-center gap-1 leading-none text-text-muted">
                  <Sparkles className="w-3 h-3 text-accent" />
                  Quiet Mind, Steady Progress • focus zone ready
                </span>
                <span>Active Board Console v1.3.0</span>
              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

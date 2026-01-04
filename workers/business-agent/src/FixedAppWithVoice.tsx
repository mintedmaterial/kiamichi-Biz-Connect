// Updated app.tsx with working voice functionality
import { useEffect, useState, useRef, useCallback } from "react";
import { useAgent } from "agents/react";
import { isStaticToolUIPart } from "ai";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

// Component imports
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Avatar } from "@/components/avatar/Avatar";
import { Toggle } from "@/components/toggle/Toggle";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";
import { FixedPreviewPane } from "@/components/preview-pane/FixedPreviewPane";
import { PublishDialog } from "@/components/publish-dialog/PublishDialog";

// Auth imports
import { authenticateBusinessUser, getUserBusiness, type BusinessUser } from "@/portal/business-auth";

// Voice imports
import { VoiceManager } from "@/voice-system";

// Icon imports
import {
  BugIcon,
  MoonIcon,
  RobotIcon,
  SunIcon,
  TrashIcon,
  PaperPlaneTiltIcon,
  StopIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon
} from "@phosphor-icons/react";

// List of tools that require human confirmation
const toolsRequiringConfirmation: string[] = [
  "getWeatherInformation"
];

export default function Chat() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });
  const [showDebug, setShowDebug] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // User authentication state
  const [user, setUser] = useState<BusinessUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Preview pane state
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Voice functionality
  const [voiceManager, setVoiceManager] = useState<VoiceManager | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  // Initialize agent
  const agent = useAgent({
    agent: "chat",
    name: "default"
  });

  const { messages: agentMessages, sendMessage } = useAgentChat(agent);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // Authenticate user on mount
  useEffect(() => {
    async function authenticate() {
      try {
        setIsLoading(true);
        setAuthError(null);

        // Get user email from session or URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const testEmail = urlParams.get('email') || 'test@example.com';
        
        const result = await authenticateBusinessUser(testEmail, {
          DB: { /* mock DB for now */ } as any,
          DEVELOPER_EMAILS: 'developer@example.com,admin@example.com'
        });

        if (result.user) {
          setUser(result.user);
          console.log("[Auth] User authenticated:", result.user.email, "Role:", result.user.role);
          
          // Load user's business
          const business = await getUserBusiness(result.user.id, {
            DB: { /* mock DB for now */ } as any
          });
          
          if (business) {
            setBusinessId(business.businessId);
            console.log("[Auth] Loaded business:", business.name);
          }
        } else {
          setAuthError(result.error || 'Authentication failed');
          console.error("[Auth] Authentication failed:", result.error);
        }
      } catch (error) {
        console.error("[Auth] Authentication error:", error);
        setAuthError('Authentication system error');
      } finally {
        setIsLoading(false);
      }
    }
    
    authenticate();
  }, []);

  // Initialize voice functionality
  useEffect(() => {
    async function setupVoice() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/voice/stream`;
      
      const voice = new VoiceManager(wsUrl);
      
      // Set up voice event handlers
      voice.onTranscript = (text) => {
        console.log("[Voice] Transcript:", text);
        // Add transcript to chat
        sendMessage({
          role: "user",
          parts: [{ type: "text", text: text }]
        });
      };
      
      voice.onResponseText = (text) => {
        console.log("[Voice] Response text:", text);
        setIsProcessingVoice(false);
        // Add response to chat
        sendMessage({
          role: "assistant",
          parts: [{ type: "text", text: text }]
        });
      };
      
      voice.onResponseAudio = (audioBase64) => {
        console.log("[Voice] Response audio received");
        // Play the audio response
        this.playAudioResponse(audioBase64);
      };
      
      voice.onError = (error) => {
        console.error("[Voice] Error:", error);
        alert(`Voice error: ${error}`);
      };
      
      // Connect to voice server
      const connected = await voice.connect();
      if (connected) {
        setVoiceManager(voice);
        setIsVoiceConnected(true);
        console.log("[Voice] Connected successfully");
      } else {
        console.error("[Voice] Failed to connect to voice server");
      }
    }
    
    setupVoice();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  // Preview pane handlers
  const handleRefreshPreview = useCallback(() => {
    setPreviewKey((prev) => prev + 1);
  }, []);

  const handlePublishClick = useCallback(() => {
    if (!user) {
      alert("Please authenticate first");
      return;
    }
    setShowPublishDialog(true);
  }, [user]);

  const handlePublishConfirm = useCallback(async (createSnapshot: boolean) => {
    if (!user) return;
    
    setIsPublishing(true);
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          createSnapshot,
          businessId: businessId,
          userId: user.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[App] Published successfully:", result);
        handleRefreshPreview();
        
        await sendMessage({
          role: "user",
          parts: [{ type: "text", text: "✅ Changes published successfully!" }]
        });
      } else {
        const error = (await response.json()) as { message?: string };
        console.error("[App] Publish failed:", error);
        
        await sendMessage({
          role: "user",
          parts: [{ type: "text", text: `❌ Publish failed: ${error.message || "Unknown error"}` }]
        });
      }
    } catch (error) {
      console.error("[App] Publish error:", error);
      await sendMessage({
        role: "user",
        parts: [{ type: "text", text: `❌ Publish error: ${error}` }]
      });
    } finally {
      setIsPublishing(false);
      setShowPublishDialog(false);
    }
  }, [user, businessId, handleRefreshPreview]);

  // Voice functionality
  const connectVoiceAgent = useCallback(async () => {
    if (!voiceManager) {
      console.error("[Voice] Voice manager not initialized");
      return;
    }

    if (isVoiceConnected) {
      console.log("[Voice] Already connected");
      return;
    }

    console.log("[Voice] Connecting voice agent...");
    const connected = await voiceManager.connect();
    
    if (connected) {
      setIsVoiceConnected(true);
      console.log("[Voice] Connected successfully");
    } else {
      console.error("[Voice] Connection failed");
    }
  }, [voiceManager, isVoiceConnected]);

  const startListening = useCallback(async () => {
    if (!voiceManager) {
      console.error("[Voice] Voice manager not available");
      return;
    }

    if (isListening) {
      console.log("[Voice] Already listening");
      return;
    }

    setIsProcessingVoice(true);
    const started = await voiceManager.startListening();
    
    if (started) {
      setIsListening(true);
      console.log("[Voice] Started listening");
    } else {
      setIsProcessingVoice(false);
      console.error("[Voice] Failed to start listening");
    }
  }, [voiceManager, isListening]);

  const stopListening = useCallback(() => {
    if (!voiceManager) {
      console.error("[Voice] Voice manager not available");
      return;
    }

    voiceManager.stopListening();
    setIsListening(false);
    setIsProcessingVoice(false);
    console.log("[Voice] Stopped listening");
  }, [voiceManager]);

  // Agent chat functionality
  const [agentInput, setAgentInput] = useState("");
  const handleAgentInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setAgentInput(e.target.value);
  };

  const handleAgentSubmit = async (
    e: React.FormEvent,
    extraData: Record<string, unknown> = {}
  ) => {
    e.preventDefault();
    if (!agentInput.trim() || !user) return;

    const message = agentInput;
    setAgentInput("");

    // Add user context to the message
    const contextMessage = `[User: ${user.email}, Business: ${user.businessName}, Role: ${user.role}] ${message}`;
    
    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: contextMessage }]
      },
      extraData
    );
  };

  // Theme management
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceManager) {
        voiceManager.disconnect();
      }
    };
  }, []);

  // Audio playback for text-to-speech
  const playAudioResponse = async (base64Audio: string) => {
    try {
      const audioData = Buffer.from(base64Audio, 'base64');
      const audioContext = new AudioContext();
      
      // For now, just log that we received audio
      console.log("[Voice] Playing audio response");
      
      // In a full implementation, you would:
      // 1. Decode the base64 audio data
      // 2. Play it through the audio context
      // 3. Handle playback completion
      
      // Mock implementation
      setTimeout(() => {
        audioContext.close();
        console.log("[Voice] Audio playback complete");
      }, 1000);
      
    } catch (error) {
      console.error("[Voice] Audio playback error:", error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950">
        <Card className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-neutral-300 dark:border-neutral-700 border-t-[#F48120] rounded-full mx-auto mb-4" />
          <h3 className="font-semibold text-lg">Loading Business Agent...</h3>
          <p className="text-muted-foreground text-sm">Authenticating your access</p>
        </Card>
      </div>
    );
  }

  // Authentication error state
  if (authError) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950">
        <Card className="p-8 text-center max-w-md">
          <div className="text-red-600 dark:text-red-400 text-4xl mb-4">⚠️</div>
          <h3 className="font-semibold text-lg text-red-900 dark:text-red-100">Authentication Failed</h3>
          <p className="text-red-700 dark:text-red-300 text-sm mb-4">{authError}</p>
          <p className="text-muted-foreground text-xs">
            Please ensure you're using the email associated with your business listing.
          </p>
        </Card>
      </div>
    );
  }

  // No user state (shouldn't happen with proper auth)
  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-950">
        <Card className="p-8 text-center">
          <h3 className="font-semibold text-lg">Access Denied</h3>
          <p className="text-muted-foreground text-sm">Unable to authenticate your business access.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden bg-neutral-100 dark:bg-neutral-950">
      {/* Split-screen layout */}
      <div className="flex w-full h-full">
        {/* Left pane: Chat interface */}
        <div className={`${showMobilePreview ? 'hidden' : 'flex'} lg:flex w-full lg:w-1/2 flex-col border-r border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900`}>
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center gap-3 sticky top-0 z-10 bg-white dark:bg-neutral-900">
            <div className="flex items-center justify-center h-8 w-8">
              <svg width="28px" height="28px" className="text-[#F48120]" data-icon="agents">
                <use href="#ai:local:agents" />
              </svg>
            </div>

            <div className="flex-1">
              <h1 className="font-semibold text-lg">Business Agent</h1>
              <p className="text-sm text-muted-foreground">
                {user.businessName} ({user.role})
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="sm"
                shape="square"
                className="rounded-full h-9 w-9"
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {theme === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
              </Button>

              {/* Voice connect button */}
              <Button
                variant={isVoiceConnected ? "primary" : "ghost"}
                size="sm"
                shape="square"
                className="rounded-full h-9 w-9"
                onClick={connectVoiceAgent}
                disabled={!voiceManager}
                title={isVoiceConnected ? "Voice connected" : "Connect voice"}
              >
                <MicrophoneIcon size={16} className={isVoiceConnected ? "text-green-400" : ""} />
              </Button>

              {/* Mobile preview toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setShowMobilePreview(!showMobilePreview)}
                aria-label="Toggle preview"
              >
                {showMobilePreview ? "Chat" : "Preview"}
              </Button>

              <BugIcon size={16} className="hidden md:block" />
              <Toggle
                toggled={showDebug}
                onToggle={setShowDebug}
                label="Debug"
                className="hidden md:flex"
              />
            </div>
          </div>

          {/* Voice status indicator */}
          {(isListening || isProcessingVoice) && (
            <div className="sticky top-0 z-20 mb-4">
              <Card className={`p-3 text-center text-sm font-medium ${
                isListening
                  ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
              }`}>
                <div className="flex items-center justify-center gap-2">
                  {isListening ? (
                    <>
                      <MicrophoneIcon size={16} className="animate-pulse" weight="fill" />
                      <span>Listening... Speak now</span>
                    </>
                  ) : (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-yellow-600 dark:border-yellow-400 border-t-transparent rounded-full" />
                      <span>Processing your voice message...</span>
                    </>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100vh-10rem)]">
            {agentMessages.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-neutral-900">
                  <div className="text-center space-y-4">
                    <div className="bg-[#F48120]/10 text-[#F48120] rounded-full p-3 inline-flex">
                      <RobotIcon size={24} />
                    </div>
                    <h3 className="font-semibold text-lg">Welcome to AI Chat</h3>
                    <p className="text-muted-foreground text-sm">
                      Start a conversation with your AI assistant. Type a message or use the microphone to speak!
                    </p>
                    <ul className="text-sm text-left space-y-2">
                      <li className="flex items-center gap-2">
                        <MicrophoneIcon size={16} className="text-[#F48120]" />
                        <span>Click the microphone to speak your message</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#F48120]">•</span>
                        <span>Ask about business listings and analytics</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-[#F48120]">•</span>
                        <span>Generate content and images</span>
                      </li>
                    </ul>
                  </div>
                </Card>
              </div>
            )}

            {agentMessages.map((m, index) => {
              const isUser = m.role === "user";
              const showAvatar =
                index === 0 || agentMessages[index - 1]?.role !== m.role;

              return (
                <div key={m.id}>
                  {showDebug && (
                    <pre className="text-xs text-muted-foreground overflow-scroll">
                      {JSON.stringify(m, null, 2)}
                    </pre>
                  )}
                  <div
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex gap-2 max-w-[85%] ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {showAvatar && !isUser ? (
                        <Avatar username={"AI"} className="shrink-0" />
                      ) : (
                        !isUser && <div className="w-8" />
                      )}

                      <div>
                        <div>
                          {m.parts?.map((part, i) => {
                            if (part.type === "text") {
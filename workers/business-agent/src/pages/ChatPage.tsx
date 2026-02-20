/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
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
import { PreviewPane } from "@/components/preview-pane/PreviewPane";
import { PublishDialog } from "@/components/publish-dialog/PublishDialog";
import { AtlasLiveView } from "@/components/atlas/AtlasLiveView";

// Icon imports
import {
  BugIcon,
  RobotIcon,
  TrashIcon,
  PaperPlaneTiltIcon,
  StopIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  EyeIcon,
} from "@phosphor-icons/react";

// List of tools that require human confirmation
const toolsRequiringConfirmation: string[] = ["getWeatherInformation"];

export function ChatPage() {
  const [showDebug, setShowDebug] = useState(false);
  const [showAtlasLive, setShowAtlasLive] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Preview pane state
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Voice agent state
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const voiceWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // Load business information on mount
  useEffect(() => {
    async function loadBusiness() {
      try {
        const response = await fetch("/api/my-business");
        if (response.ok) {
          const data = (await response.json()) as { businessId: number; name: string };
          setBusinessId(data.businessId);
          console.log("[Chat] Loaded business:", data.name, "ID:", data.businessId);
        } else {
          console.warn("[Chat] No business found for this session");
        }
      } catch (error) {
        console.error("[Chat] Error loading business:", error);
      }
    }
    loadBusiness();
  }, []);

  // Preview pane handlers
  const handleRefreshPreview = useCallback(() => {
    setPreviewKey((prev) => prev + 1);
  }, []);

  const handlePublishClick = useCallback(() => {
    setShowPublishDialog(true);
  }, []);

  const handlePublishConfirm = useCallback(async (createSnapshot: boolean) => {
    setIsPublishing(true);
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createSnapshot }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[Chat] Published successfully:", result);
        handleRefreshPreview();
        await sendMessage({
          role: "user",
          parts: [{ type: "text", text: "✅ Changes published successfully!" }],
        });
      } else {
        const error = (await response.json()) as { message?: string };
        console.error("[Chat] Publish failed:", error);
        await sendMessage({
          role: "user",
          parts: [{ type: "text", text: `❌ Publish failed: ${error.message || "Unknown error"}` }],
        });
      }
    } catch (error) {
      console.error("[Chat] Publish error:", error);
      await sendMessage({
        role: "user",
        parts: [{ type: "text", text: `❌ Publish error: ${error}` }],
      });
    } finally {
      setIsPublishing(false);
      setShowPublishDialog(false);
    }
  }, [handleRefreshPreview]);

  // Initialize agent
  const agent = useAgent({
    agent: "chat",
    name: "default",
  });

  const [agentInput, setAgentInput] = useState("");
  const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setAgentInput(e.target.value);
  };

  const handleAgentSubmit = async (e: React.FormEvent, extraData: Record<string, unknown> = {}) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const message = agentInput;
    setAgentInput("");

    await sendMessage(
      { role: "user", parts: [{ type: "text", text: message }] },
      { body: extraData }
    );
  };

  const {
    messages: agentMessages,
    addToolResult,
    clearHistory,
    status,
    sendMessage,
    stop,
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({ agent });

  // Scroll to bottom when messages change
  useEffect(() => {
    agentMessages.length > 0 && scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  // Listen for tool results with refreshPreview flag
  useEffect(() => {
    if (agentMessages.length === 0) return;

    const latestMessage = agentMessages[agentMessages.length - 1];
    if (latestMessage.role !== "assistant") return;

    const hasRefreshFlag = latestMessage.parts?.some((part) => {
      if (part.type === "tool-result") {
        const result = (part as any).result;
        return result && typeof result === "object" && result.refreshPreview === true;
      }
      return false;
    });

    if (hasRefreshFlag) {
      console.log("[Chat] Tool returned refreshPreview, refreshing preview pane");
      handleRefreshPreview();
    }
  }, [agentMessages, handleRefreshPreview]);

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part) =>
        isStaticToolUIPart(part) &&
        part.state === "input-available" &&
        toolsRequiringConfirmation.includes(part.type.replace("tool-", ""))
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Voice agent functions
  const connectVoiceAgent = useCallback(() => {
    if (voiceWsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/voice/stream`;

    const ws = new WebSocket(wsUrl);
    voiceWsRef.current = ws;

    ws.onopen = () => {
      setIsVoiceConnected(true);
      console.log("[Voice] Connected to voice agent");
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("[Voice] Received:", data.type);

      switch (data.type) {
        case "transcript":
          await sendMessage({ role: "user", parts: [{ type: "text", text: data.text }] });
          break;
        case "response-text":
          setIsProcessingVoice(false);
          break;
        case "audio-response":
          await playAudioResponse(data.audio);
          setIsProcessingVoice(false);
          break;
        case "processing":
          setIsProcessingVoice(true);
          break;
        case "error":
          console.error("[Voice] Error:", data.error);
          setIsProcessingVoice(false);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error("[Voice] WebSocket error:", error);
      setIsVoiceConnected(false);
    };

    ws.onclose = (event) => {
      setIsVoiceConnected(false);
      setIsListening(false);
      console.log("[Voice] Disconnected, code:", event.code, "reason:", event.reason);

      if (event.code === 1006 || event.reason.includes("upgraded")) {
        console.log("[Voice] Attempting auto-reconnect due to script upgrade...");
        setTimeout(() => connectVoiceAgent(), 1000);
      }
    };
  }, [sendMessage]);

  const toggleMicrophone = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening]);

  const startListening = async () => {
    if (!isVoiceConnected) {
      connectVoiceAgent();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      mediaStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      console.log("[Voice] AudioContext sample rate:", audioContext.sampleRate);

      const source = audioContext.createMediaStreamSource(stream);
      audioSourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isListening || !voiceWsRef.current || voiceWsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = float32ToInt16(inputData);

        voiceWsRef.current.send(
          JSON.stringify({
            type: "audio-chunk",
            audio: arrayBufferToBase64(pcmData.buffer as ArrayBuffer),
          })
        );
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);

      if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
        voiceWsRef.current.send(JSON.stringify({ type: "start-listening" }));
      }
    } catch (error) {
      console.error("[Voice] Microphone error:", error);
      alert("Microphone access denied. Please allow microphone access to use voice chat.");
    }
  };

  const stopListening = () => {
    if (voiceWsRef.current?.readyState === WebSocket.OPEN) {
      voiceWsRef.current.send(JSON.stringify({ type: "stop-listening" }));
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
  };

  const playAudioResponse = async (base64Audio: string) => {
    try {
      const audioData = base64ToArrayBuffer(base64Audio);
      const playbackContext = new AudioContext();
      const audioBuffer = await playbackContext.decodeAudioData(audioData);

      const source = playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackContext.destination);
      source.start(0);

      console.log("[Voice] Playing audio:", audioBuffer.duration.toFixed(2), "seconds");

      return new Promise<void>((resolve) => {
        source.onended = () => {
          playbackContext.close();
          resolve();
        };
      });
    } catch (error) {
      console.error("[Voice] Audio playback error:", error);
    }
  };

  // Utility functions
  const float32ToInt16 = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (voiceWsRef.current) {
        voiceWsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat pane */}
      <div className={`${showMobilePreview ? "hidden" : "flex"} lg:flex flex-1 flex-col bg-[#0D0D0F]`}>
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-[#27272a] flex items-center gap-3 bg-[#141419]">
          <div className="flex-1 flex items-center gap-2">
            <BugIcon size={16} className="text-neutral-400" />
            <Toggle
              toggled={showDebug}
              aria-label="Toggle debug mode"
              onClick={() => setShowDebug((prev) => !prev)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">🌳</span>
            <Toggle
              toggled={showAtlasLive}
              aria-label="Toggle Atlas Live View"
              onClick={() => setShowAtlasLive((prev) => !prev)}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowMobilePreview(!showMobilePreview)}
          >
            <EyeIcon size={18} />
            Preview
          </Button>

          <Button variant="ghost" size="sm" onClick={clearHistory}>
            <TrashIcon size={18} />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
          {/* Voice status indicator */}
          {(isListening || isProcessingVoice) && (
            <div className="sticky top-0 z-20 mb-4">
              <Card
                className={`p-3 text-center text-sm font-medium ${
                  isListening
                    ? "bg-red-900/20 text-red-400 border-red-800"
                    : "bg-yellow-900/20 text-yellow-400 border-yellow-800"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {isListening ? (
                    <>
                      <MicrophoneIcon size={16} className="animate-pulse" weight="fill" />
                      <span>Listening... Speak now</span>
                    </>
                  ) : (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-yellow-400 border-t-transparent rounded-full" />
                      <span>Processing your voice message...</span>
                    </>
                  )}
                </div>
              </Card>
            </div>
          )}

          {agentMessages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <Card className="p-6 max-w-md mx-auto bg-[#141419] border-[#27272a]">
                <div className="text-center space-y-4">
                  <div className="bg-amber-500/10 text-amber-500 rounded-full p-3 inline-flex">
                    <RobotIcon size={24} />
                  </div>
                  <h3 className="font-semibold text-lg text-neutral-100">Welcome to KBC Agent</h3>
                  <p className="text-neutral-400 text-sm">
                    Start a conversation to manage your business listing, generate content, or make updates.
                  </p>
                  <ul className="text-sm text-left space-y-2 text-neutral-400">
                    <li className="flex items-center gap-2">
                      <MicrophoneIcon size={16} className="text-amber-500" />
                      <span>Click the microphone to speak</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-500">•</span>
                      <span>Ask about listings and analytics</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-500">•</span>
                      <span>Generate content and images</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </div>
          )}

          {agentMessages.map((m, index) => {
            const isUser = m.role === "user";
            const showAvatar = index === 0 || agentMessages[index - 1]?.role !== m.role;

            return (
              <div key={m.id}>
                {showDebug && (
                  <pre className="text-xs text-neutral-500 overflow-scroll">{JSON.stringify(m, null, 2)}</pre>
                )}
                <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-2 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    {showAvatar && !isUser ? <Avatar username={"AI"} className="shrink-0" /> : !isUser && <div className="w-8" />}

                    <div>
                      {m.parts?.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            <div key={i}>
                              <Card
                                className={`p-3 rounded-lg bg-[#141419] border-[#27272a] ${
                                  isUser ? "rounded-br-none" : "rounded-bl-none"
                                } ${part.text.startsWith("scheduled message") ? "border-amber-500/50" : ""} relative`}
                              >
                                {part.text.startsWith("scheduled message") && (
                                  <span className="absolute -top-3 -left-2 text-base">🕒</span>
                                )}
                                <MemoizedMarkdown
                                  id={`${m.id}-${i}`}
                                  content={part.text.replace(/^scheduled message: /, "")}
                                />
                              </Card>
                              <p className={`text-xs text-neutral-500 mt-1 ${isUser ? "text-right" : "text-left"}`}>
                                {formatTime(m.metadata?.createdAt ? new Date(m.metadata.createdAt) : new Date())}
                              </p>
                            </div>
                          );
                        }

                        if (isStaticToolUIPart(part) && m.role === "assistant") {
                          const toolCallId = part.toolCallId;
                          const toolName = part.type.replace("tool-", "");
                          const needsConfirmation = toolsRequiringConfirmation.includes(toolName);

                          return (
                            <ToolInvocationCard
                              key={`${toolCallId}-${i}`}
                              toolUIPart={part}
                              toolCallId={toolCallId}
                              needsConfirmation={needsConfirmation}
                              onSubmit={({ toolCallId, result }) => {
                                addToolResult({
                                  tool: part.type.replace("tool-", ""),
                                  toolCallId,
                                  output: result,
                                });
                              }}
                              addToolResult={(toolCallId, result) => {
                                addToolResult({
                                  tool: part.type.replace("tool-", ""),
                                  toolCallId,
                                  output: result,
                                });
                              }}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAgentSubmit(e, { annotations: { hello: "world" } });
            setTextareaHeight("auto");
          }}
          className="p-3 bg-[#141419] border-t border-[#27272a]"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Textarea
                disabled={pendingToolCallConfirmation}
                placeholder={pendingToolCallConfirmation ? "Please respond to the tool confirmation above..." : "Send a message..."}
                className="flex w-full border border-[#27272a] bg-[#0D0D0F] px-3 py-2 ring-offset-background placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl text-base! pb-10 text-neutral-100"
                value={agentInput}
                onChange={(e) => {
                  handleAgentInputChange(e);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setTextareaHeight(`${e.target.scrollHeight}px`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleAgentSubmit(e as unknown as React.FormEvent);
                    setTextareaHeight("auto");
                  }
                }}
                rows={2}
                style={{ height: textareaHeight }}
              />
              <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row gap-2 justify-end">
                {/* Microphone button */}
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  className={`inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-full p-1.5 h-fit border ${
                    isListening
                      ? "bg-red-500 text-white border-red-600 hover:bg-red-600 animate-pulse"
                      : isProcessingVoice
                      ? "bg-yellow-500 text-white border-yellow-600"
                      : "bg-amber-500 text-white hover:bg-amber-600 border-amber-600"
                  }`}
                  disabled={pendingToolCallConfirmation || status === "submitted" || status === "streaming"}
                  aria-label={isListening ? "Stop listening" : "Start voice input"}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? <MicrophoneSlashIcon size={16} weight="fill" /> : <MicrophoneIcon size={16} />}
                </button>

                {/* Send/Stop button */}
                {status === "submitted" || status === "streaming" ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-amber-500 text-white hover:bg-amber-600 rounded-full p-1.5 h-fit border border-amber-600"
                    aria-label="Stop generation"
                  >
                    <StopIcon size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-amber-500 text-white hover:bg-amber-600 rounded-full p-1.5 h-fit border border-amber-600"
                    disabled={pendingToolCallConfirmation || !agentInput.trim()}
                    aria-label="Send message"
                  >
                    <PaperPlaneTiltIcon size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Preview pane */}
      <div className={`${showMobilePreview ? "flex" : "hidden"} lg:flex w-full lg:w-1/2 bg-[#0D0D0F] border-l border-[#27272a]`}>
        <PreviewPane
          businessId={businessId}
          previewKey={previewKey}
          onPublish={handlePublishClick}
          onRefresh={handleRefreshPreview}
          isPublishing={isPublishing}
        />
      </div>

      {/* Publish Dialog */}
      <PublishDialog
        isOpen={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        onConfirm={handlePublishConfirm}
        isPublishing={isPublishing}
      />

      {/* Atlas Live View Panel */}
      {showAtlasLive && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute right-0 top-0 bottom-0 w-full lg:w-2/3 xl:w-1/2 bg-[#0D0D0F] shadow-2xl overflow-hidden flex flex-col">
            <div className="absolute top-4 right-4 z-10">
              <Button variant="ghost" size="sm" onClick={() => setShowAtlasLive(false)} className="rounded-full">
                ✕
              </Button>
            </div>
            <AtlasLiveView />
          </div>
        </div>
      )}
    </div>
  );
}

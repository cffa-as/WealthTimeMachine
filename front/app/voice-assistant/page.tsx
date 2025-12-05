"use client"

import React, { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Loader2, Send, MessageCircle, Sparkles } from "lucide-react"
import { getTTSVoices, generateTTS } from "@/lib/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function AudioButton({
  isPlaying,
  isLoading,
  onClick,
  disabled,
}: {
  isPlaying: boolean
  isLoading: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        relative w-12 h-12 rounded-2xl
        flex items-center justify-center
        transition-all duration-300 ease-out
        ${
          isPlaying
            ? "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25"
            : "bg-gradient-to-br from-muted to-muted/80 hover:from-primary/10 hover:to-primary/5"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        border border-border/50
        group
        overflow-hidden
      `}
    >
      {isPlaying && <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-2xl" />}

      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex items-end justify-center gap-[3px] h-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`
                w-[3px] rounded-full transition-all duration-150
                ${isPlaying ? "bg-primary-foreground" : "bg-muted-foreground group-hover:bg-primary"}
              `}
              style={{
                height: isPlaying ? undefined : `${8 + i * 3}px`,
                animation: isPlaying ? `audioWave 0.8s ease-in-out infinite ${i * 0.1}s` : "none",
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute inset-0 rounded-2xl opacity-0 group-active:opacity-100 bg-foreground/10 transition-opacity" />
    </button>
  )
}

export default function VoiceAssistantPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Array<{ type: "user" | "ai"; text: string; timestamp: Date }>>([])
  const [inputText, setInputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<string>("Cherry")
  const [availableVoices, setAvailableVoices] = useState<Record<string, { name: string; description: string; dialect: string }>>({})
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [lastAiMessage, setLastAiMessage] = useState<string>("") // 最后一条AI消息，用于语音播放
  const [currentAiMessage, setCurrentAiMessage] = useState<string>("") // 当前正在流式接收的AI消息
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)
  const currentMessageIndexRef = useRef<number>(-1) // 当前正在流式更新的消息索引
  const isInitialLoadRef = useRef(true) // 标记是否是首次加载

  // 加载音色列表
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const voices = await getTTSVoices()
        setAvailableVoices(voices)
        // 从sessionStorage获取之前选中的音色
        const savedVoice = sessionStorage.getItem("selectedVoice")
        if (savedVoice && voices[savedVoice]) {
          setSelectedVoice(savedVoice)
        }
      } catch (error) {
        console.error("加载音色列表失败:", error)
      }
    }
    loadVoices()
  }, [])

  // 页面加载时滚动到顶部
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 立即滚动到顶部
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      // 确保消息列表容器也滚动到顶部
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = 0
      }
      // 延迟再次确保（防止其他逻辑覆盖）
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = 0
        }
      }, 100)
      isInitialLoadRef.current = false
    }
  }, [])
  
  // 自动滚动到底部（仅在有新消息时）
  useEffect(() => {
    // 只在消息数量增加时滚动（说明有新消息），而不是初始加载
    if (!isInitialLoadRef.current && messages.length > prevMessagesLengthRef.current && messages.length > 0) {
      // 延迟一下，确保DOM已更新
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages.length])

  // 添加消息
  const addMessage = (type: "user" | "ai", text: string) => {
    setMessages(prev => [...prev, { type, text, timestamp: new Date() }])
    if (type === "ai") {
      setLastAiMessage(text)
    }
  }

  // 处理语音播放
  const handlePlayAudio = async () => {
    if (!lastAiMessage) return
    
    try {
      setIsGeneratingAudio(true)
      const response = await generateTTS(lastAiMessage, selectedVoice)
      
      if (response) {
        // 后端返回的是base64编码的PCM数据
        // 需要转换为WAV格式才能在浏览器播放
        const audioBytes = Uint8Array.from(atob(response), c => c.charCodeAt(0))
        
        // 创建WAV文件头（24kHz, 16bit, 单声道）
        const sampleRate = 24000
        const numChannels = 1
        const bitsPerSample = 16
        const dataLength = audioBytes.length
        const wavLength = 44 + dataLength
        
        const wavBuffer = new ArrayBuffer(wavLength)
        const view = new DataView(wavBuffer)
        
        // WAV文件头
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i))
          }
        }
        
        writeString(0, 'RIFF')
        view.setUint32(4, wavLength - 8, true)
        writeString(8, 'WAVE')
        writeString(12, 'fmt ')
        view.setUint32(16, 16, true) // fmt chunk size
        view.setUint16(20, 1, true) // audio format (PCM)
        view.setUint16(22, numChannels, true)
        view.setUint32(24, sampleRate, true)
        view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true) // byte rate
        view.setUint16(32, numChannels * bitsPerSample / 8, true) // block align
        view.setUint16(34, bitsPerSample, true)
        writeString(36, 'data')
        view.setUint32(40, dataLength, true)
        
        // 复制PCM数据
        const wavBytes = new Uint8Array(wavBuffer)
        wavBytes.set(audioBytes, 44)
        
        // 创建Blob和URL
        const blob = new Blob([wavBuffer], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        
        // 创建Audio元素播放
        setIsGeneratingAudio(false)
        const audio = new Audio(url)
        audio.onended = () => {
          setIsPlayingAudio(false)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          setIsPlayingAudio(false)
          setIsGeneratingAudio(false)
          URL.revokeObjectURL(url)
        }
        
        setIsPlayingAudio(true)
        setAudioUrl(url)
        setAudioElement(audio)
        await audio.play()
      }
    } catch (error) {
      console.error("播放语音失败:", error)
      setIsPlayingAudio(false)
      setIsGeneratingAudio(false)
    }
  }
  
  // 停止播放
  const handleStopAudio = () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    setIsPlayingAudio(false)
    setIsGeneratingAudio(false)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioElement(null)
  }

  // 发送消息（流式）
  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return

    const userText = inputText.trim()
    setInputText("")
    addMessage("user", userText)
    setIsProcessing(true)
    
    // 获取推荐的理财产品信息
    const recommendationData = sessionStorage.getItem("recommendationData")
    let recommendation = null
    if (recommendationData) {
      try {
        const data = JSON.parse(recommendationData)
        const recommendedRisk = data.recommendedRisk || "medium"
        const rec = data.recommendations?.[recommendedRisk]
        if (rec) {
          recommendation = {
            riskLevel: recommendedRisk,
            expectedReturn: rec.expectedReturn,
            monthlySave: rec.monthlySave,
            targetMonths: rec.targetMonths,
            reason: rec.reason
          }
        }
      } catch (e) {
        console.error("解析推荐数据失败:", e)
      }
    }

    try {
      // 调用后端API获取AI回复（流式）
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
          recommendation: recommendation,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 创建AI消息占位
      const aiMessageIndex = messages.length + 1
      currentMessageIndexRef.current = aiMessageIndex
      setCurrentAiMessage("")
      addMessage("ai", "") // 先添加空消息，后续流式更新
      
      // 读取流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullResponse = ""

      if (!reader) {
        throw new Error("无法读取响应流")
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === "chunk") {
                // 流式更新消息
                fullResponse += data.content
                setCurrentAiMessage(fullResponse)
                // 更新消息列表中的最后一条AI消息
                setMessages(prev => {
                  const newMessages = [...prev]
                  if (newMessages[newMessages.length - 1]?.type === "ai") {
                    newMessages[newMessages.length - 1] = {
                      ...newMessages[newMessages.length - 1],
                      text: fullResponse
                    }
                  }
                  return newMessages
                })
              } else if (data.type === "complete") {
                // 完成
                const finalResponse = data.content || fullResponse
                setCurrentAiMessage(finalResponse)
                setLastAiMessage(finalResponse)
                setMessages(prev => {
                  const newMessages = [...prev]
                  if (newMessages[newMessages.length - 1]?.type === "ai") {
                    newMessages[newMessages.length - 1] = {
                      ...newMessages[newMessages.length - 1],
                      text: finalResponse
                    }
                  }
                  return newMessages
                })
                currentMessageIndexRef.current = -1
              }
            } catch (e) {
              console.error("解析流式数据失败:", e)
            }
          }
        }
      }
    } catch (error) {
      console.error("发送消息失败:", error)
      addMessage("ai", "抱歉，发送消息失败，请稍后重试。")
      currentMessageIndexRef.current = -1
    } finally {
      setIsProcessing(false)
      setCurrentAiMessage("")
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <style jsx global>{`
        @keyframes audioWave {
          0%, 100% { height: 6px; }
          50% { height: 18px; }
        }
      `}</style>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI 理财咨询</h1>
              <p className="text-sm text-muted-foreground">智能对话，专业建议</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 p-4 bg-card rounded-2xl border border-border shadow-sm">
          <span className="text-sm text-muted-foreground">音色</span>
          <select
            value={selectedVoice}
            onChange={(e) => {
              setSelectedVoice(e.target.value)
              sessionStorage.setItem("selectedVoice", e.target.value)
            }}
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            disabled={isProcessing || isPlayingAudio || isGeneratingAudio}
          >
            {Object.entries(availableVoices).length > 0 ? (
              Object.entries(availableVoices).map(([key, voice]) => (
                <option key={key} value={key}>
                  {voice.name} ({voice.dialect})
                </option>
              ))
            ) : (
              <option value="Cherry">芊悦 (普通话)</option>
            )}
          </select>
          {lastAiMessage && (
            <AudioButton
              isPlaying={isPlayingAudio}
              isLoading={isGeneratingAudio}
              onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
              disabled={isProcessing}
            />
          )}
        </div>

        {/* Messages Area */}
        <div className="bg-card rounded-2xl border border-border shadow-sm mb-4 overflow-hidden">
          <div ref={messagesContainerRef} className="h-[320px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">欢迎使用 AI 智能客服</h3>
                <p className="text-sm text-muted-foreground max-w-[240px]">您可以与 AI 交流理财问题，获取专业建议</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.type === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <p
                      className={`text-xs mt-2 ${
                        msg.type === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isProcessing && !(messages[messages.length - 1]?.type === "ai") && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            placeholder="输入您的问题..."
            className="flex-1 px-4 py-3 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-card text-foreground placeholder:text-muted-foreground transition-all"
            disabled={isProcessing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isProcessing}
            size="icon"
            className="h-12 w-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">AI 建议仅供参考，投资有风险</p>
      </div>
    </div>
  )
}

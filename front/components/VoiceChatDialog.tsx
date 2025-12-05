"use client"

import React, { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Volume2, Mic, MicOff, Loader2, Send } from "lucide-react"

interface VoiceChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  voice: string // 选中的音色
}

export function VoiceChatDialog({ open, onOpenChange, voice }: VoiceChatDialogProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [messages, setMessages] = useState<Array<{ type: "user" | "ai"; text: string; timestamp: Date }>>([])
  const [inputText, setInputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  // 初始化 WebSocket 连接
  useEffect(() => {
    if (open) {
      connectWebSocket()
    } else {
      disconnectWebSocket()
    }

    return () => {
      disconnectWebSocket()
    }
  }, [open, voice])

  const connectWebSocket = () => {
    try {
      setIsConnecting(true)
      // 支持 ws 和 wss
      const wsUrl = API_BASE_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:")
      const ws = new WebSocket(`${wsUrl}/api/voice-chat`)
      
      ws.onopen = () => {
        console.log("WebSocket连接已建立")
        // 发送初始配置
        ws.send(JSON.stringify({ type: "config", voice }))
      }

      ws.onmessage = async (event) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data)
            
            if (data.type === "ready") {
              setIsConnecting(false)
              setIsProcessing(false)
              console.log("语音对话就绪")
            } else if (data.type === "text") {
              // 收到文本消息（识别结果或AI回复）
              if (data.isUser) {
                addMessage("user", data.text)
                // 自动发送给AI处理
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: "sentence", text: data.text }))
                }
              } else {
                addMessage("ai", data.text)
                setIsProcessing(false)
              }
            } else if (data.type === "audio") {
              // 收到音频数据
              if (data.text) {
                addMessage("ai", data.text)
              }
              setIsProcessing(false)
              // 播放音频
              playAudio(data.audio)
            } else if (data.type === "error") {
              console.error("语音对话错误:", data.message)
              addMessage("ai", `错误: ${data.message}`)
              setIsProcessing(false)
            }
          }
        } catch (error) {
          console.error("解析消息失败:", error)
          setIsProcessing(false)
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket错误:", error)
        setIsConnecting(false)
      }

      ws.onclose = () => {
        console.log("WebSocket连接已关闭")
        setIsConnecting(false)
        stopRecording()
      }

      wsRef.current = ws
    } catch (error) {
      console.error("连接WebSocket失败:", error)
      setIsConnecting(false)
    }
  }

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "stop" }))
      wsRef.current.close()
      wsRef.current = null
    }
    stopRecording()
  }

  const startRecording = async () => {
    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // 创建 AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0)
          // 转换为 16-bit PCM
          const pcmData = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          // 发送音频数据
          wsRef.current.send(pcmData.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      processorRef.current = processor

      setIsRecording(true)
    } catch (error) {
      console.error("启动录音失败:", error)
      alert("无法访问麦克风，请检查权限设置")
    }
  }

  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    setIsRecording(false)
  }

  const playAudio = (audioBase64: string) => {
    try {
      // 将 base64 转换为 WAV
      const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
      const sampleRate = 24000
      const numChannels = 1
      const bitsPerSample = 16
      const dataLength = audioBytes.length
      const wavLength = 44 + dataLength

      const wavBuffer = new ArrayBuffer(wavLength)
      const view = new DataView(wavBuffer)

      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i))
        }
      }

      writeString(0, 'RIFF')
      view.setUint32(4, wavLength - 8, true)
      writeString(8, 'WAVE')
      writeString(12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, numChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true)
      view.setUint16(32, numChannels * bitsPerSample / 8, true)
      view.setUint16(34, bitsPerSample, true)
      writeString(36, 'data')
      view.setUint32(40, dataLength, true)

      const wavBytes = new Uint8Array(wavBuffer)
      wavBytes.set(audioBytes, 44)

      const blob = new Blob([wavBuffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)

      if (audioElementRef.current) {
        audioElementRef.current.pause()
      }

      const audio = new Audio(url)
      audioElementRef.current = audio
      audio.play()
      audio.onended = () => {
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("播放音频失败:", error)
    }
  }

  const addMessage = (type: "user" | "ai", text: string) => {
    setMessages(prev => [...prev, { type, text, timestamp: new Date() }])
  }

  const handleSendText = async () => {
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const text = inputText.trim()
    setInputText("")
    addMessage("user", text)
    setIsProcessing(true)

    try {
      wsRef.current.send(JSON.stringify({ type: "text", text }))
    } catch (error) {
      console.error("发送消息失败:", error)
      setIsProcessing(false)
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md z-[10000]">
        <DialogHeader>
          <DialogTitle>AI语音助手</DialogTitle>
          <DialogDescription>
            您可以语音对话或输入文字与AI交流理财问题
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 消息列表 */}
          <div className="h-64 overflow-y-auto border rounded-lg p-4 space-y-2">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                开始对话吧！点击麦克风按钮说话，或输入文字发送消息。
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.type === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm">{msg.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center gap-2">
            <Button
              variant={isRecording ? "destructive" : "default"}
              size="lg"
              onClick={toggleRecording}
              disabled={isConnecting || isProcessing}
              className="flex-1"
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  停止录音
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  开始录音
                </>
              )}
            </Button>
          </div>

          {/* 文字输入 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendText()}
              placeholder="输入文字消息..."
              className="flex-1 px-3 py-2 border rounded-md"
              disabled={isConnecting || isProcessing}
            />
            <Button
              onClick={handleSendText}
              disabled={!inputText.trim() || isConnecting || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {isConnecting && (
            <div className="text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              正在连接...
            </div>
          )}
        </div>

        <audio ref={audioElementRef} />
      </DialogContent>
    </Dialog>
  )
}


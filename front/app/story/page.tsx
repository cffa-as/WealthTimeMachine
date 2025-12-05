"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Home } from "lucide-react"
import { StoryChapter } from "@/components/story-chapter"
import { generateStoryFromAPIStream } from "@/lib/api"

interface Chapter {
  title: string
  content: string
  data?: Record<string, any>
  timeline?: Array<{ date: string; event: string }>
  image?: string  // 腾讯云生成的图片URL
  imageGenerating?: boolean  // 图片生成中
}

export default function StoryPage() {
  const router = useRouter()
  const [currentChapter, setCurrentChapter] = useState(0)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [streamingText, setStreamingText] = useState("")
  const [imageGeneratingStatus, setImageGeneratingStatus] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const financialData = sessionStorage.getItem("financialData")
    const selectedPath = sessionStorage.getItem("selectedPath")

    if (!financialData || !selectedPath) {
      router.push("/")
      return
    }

    // 调用后端API流式生成故事
    const loadStory = async () => {
      try {
        const parsedData = JSON.parse(financialData)
        const parsedPath = JSON.parse(selectedPath)
        
        let fullText = ""
        let jsonStartDetected = false
        
        await generateStoryFromAPIStream(
          parsedData,
          parsedPath,
          // onChunk: 实时接收文本片段
          (chunk: string) => {
            // 一旦检测到JSON开始，完全忽略所有后续chunk
            if (jsonStartDetected) {
              return  // 不再处理任何chunk
            }
            
            fullText += chunk
            
            // 检测JSON开始标记（更严格的检测）
            const hasJsonStart = 
              chunk.includes("```json") || 
              chunk.includes('{"chapters"') || 
              (chunk.includes('"chapters"') && chunk.includes('[')) ||
              (chunk.includes('{') && chunk.includes('"chapters"')) ||
              fullText.includes('"chapters"')  // 检查累积文本
            
            if (hasJsonStart) {
              jsonStartDetected = true
              setStreamingText("AI正在整理故事结构，请稍候...")
              return  // 一旦检测到JSON，就不再显示后续内容
            } else {
              // 在JSON开始前，显示流式文本（限制长度，避免显示太多）
              const displayText = fullText.length > 150 ? "..." + fullText.slice(-150) : fullText
              // 只显示非JSON的文本内容
              if (!displayText.includes('"chapters"') && !displayText.includes('```json') && !displayText.includes('"title"')) {
                setStreamingText(`AI正在创作您的财务故事...\n\n${displayText}`)
              }
            }
          },
          // onComplete: 接收完整的故事数据
          (chapters: Chapter[]) => {
            console.log("收到完整章节数据:", chapters)
            if (chapters && chapters.length > 0) {
              setChapters(chapters)
              setStreamingText("")
              setIsLoading(false)
            } else {
              console.error("章节数据为空")
              setIsLoading(false)
              setStreamingText("")
            }
          },
          // onError: 处理错误
          (error: string) => {
            console.error("生成故事失败:", error)
            setIsLoading(false)
            setStreamingText("")
          },
          // onImageUpdate: 图片生成进度更新
          (update: { type: string; chapterIndex: number; imageUrl?: string; chapterTitle?: string }) => {
            if (update.type === "image_generating") {
              // 开始生成图片
              setImageGeneratingStatus(prev => ({
                ...prev,
                [update.chapterIndex]: true
              }))
              // 同时更新章节的 imageGenerating 状态，以便组件显示加载状态
              setChapters(prev => {
                const newChapters = [...prev]
                if (newChapters[update.chapterIndex]) {
                  newChapters[update.chapterIndex] = {
                    ...newChapters[update.chapterIndex],
                    imageGenerating: true
                  }
                }
                return newChapters
              })
            } else if (update.type === "image_complete") {
              // 图片生成完成，更新章节数据
              setChapters(prev => {
                const newChapters = [...prev]
                if (newChapters[update.chapterIndex]) {
                  newChapters[update.chapterIndex] = {
                    ...newChapters[update.chapterIndex],
                    image: update.imageUrl,
                    imageGenerating: false
                  }
                }
                return newChapters
              })
              setImageGeneratingStatus(prev => ({
                ...prev,
                [update.chapterIndex]: false
              }))
            } else if (update.type === "image_failed") {
              // 图片生成失败，标记为失败状态
              setChapters(prev => {
                const newChapters = [...prev]
                if (newChapters[update.chapterIndex]) {
                  newChapters[update.chapterIndex] = {
                    ...newChapters[update.chapterIndex],
                    imageGenerating: false  // false 表示生成失败，会显示占位图
                  }
                }
                return newChapters
              })
              setImageGeneratingStatus(prev => ({
                ...prev,
                [update.chapterIndex]: false
              }))
            }
          }
        )
      } catch (error) {
        console.error("生成故事失败:", error)
        setIsLoading(false)
        setStreamingText("")
      }
    }

    loadStory()
  }, [router])

  const handlePrevChapter = () => {
    if (currentChapter > 0) {
      setCurrentChapter(currentChapter - 1)
    }
  }

  const handleNextChapter = () => {
    if (currentChapter < chapters.length - 1) {
      setCurrentChapter(currentChapter + 1)
    }
  }

  const handleStartNew = () => {
    sessionStorage.clear()
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl w-full">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base sm:text-lg text-muted-foreground mb-4">正在生成你的财务故事...</p>
          {streamingText && (
            <div className="mt-6 p-4 bg-card rounded-lg border border-border max-w-3xl mx-auto">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <pre className="text-xs sm:text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {streamingText}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 如果没有章节数据且不在加载中，显示错误
  if (!isLoading && (!chapters || chapters.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl w-full">
          <p className="text-base sm:text-lg text-muted-foreground mb-4">未能生成故事内容，请重试</p>
          <Button onClick={() => router.push("/planning")}>返回</Button>
        </div>
      </div>
    )
  }

  // 如果有章节数据，显示故事内容
  if (chapters && chapters.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20 pb-safe">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 sticky top-0 bg-gradient-to-br from-background via-secondary/30 to-accent/20 py-2 z-10 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static">
            <Button variant="ghost" onClick={() => router.push("/planning")} size="sm" className="-ml-2">
              <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">返回</span>
            </Button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>你的财务剧本</span>
            </div>
          </div>

          {/* Chapter Navigation */}
          <div className="mb-6 sm:mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
              {chapters.map((chapter, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentChapter(index)}
                  className={`px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap transition-all flex-shrink-0 snap-start text-sm sm:text-base active:scale-95 ${
                    currentChapter === index
                      ? "bg-primary text-primary-foreground shadow-lg scale-105"
                      : "bg-card hover:bg-secondary"
                  }`}
                >
                  {chapter.title}
                </button>
              ))}
            </div>
          </div>

          {/* Story Content */}
          <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
            <StoryChapter chapter={chapters[currentChapter]} />
          </div>

          {/* Navigation Controls */}
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 sm:gap-4 sticky bottom-4 sm:static bg-background/80 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none p-3 sm:p-0 rounded-xl sm:rounded-none -mx-4 sm:mx-0">
            <Button
              variant="outline"
              onClick={handlePrevChapter}
              disabled={currentChapter === 0}
              size="default"
              className="flex-1 sm:flex-initial h-11 sm:h-10 active:scale-95 bg-transparent"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-1" />
              <span className="hidden sm:inline">上一章</span>
            </Button>

            <div className="text-xs sm:text-sm text-muted-foreground font-medium px-2">
              {currentChapter + 1} / {chapters.length}
            </div>

            {currentChapter === chapters.length - 1 ? (
              <Button
                onClick={handleStartNew}
                size="default"
                className="flex-1 sm:flex-initial h-11 sm:h-10 active:scale-95"
              >
                <Home className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                <span className="hidden sm:inline">开始新目标</span>
                <span className="sm:hidden">新目标</span>
              </Button>
            ) : (
              <Button
                onClick={handleNextChapter}
                size="default"
                className="flex-1 sm:flex-initial h-11 sm:h-10 active:scale-95"
              >
                <span className="hidden sm:inline">下一章</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 sm:ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 默认返回null（不应该到达这里）
  return null
}

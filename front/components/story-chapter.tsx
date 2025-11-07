import { Card } from "@/components/ui/card"
import { TrendingUp, Target, Clock, CheckCircle2 } from "lucide-react"
import Image from "next/image"

interface Chapter {
  title: string
  content: string
  data?: Record<string, any>
  timeline?: Array<{ date: string; event: string }>
  imageQuery?: string
  image?: string  // 腾讯云生成的图片URL
  imageGenerating?: boolean  // 图片生成中
}

interface StoryChapterProps {
  chapter: Chapter
}

export function StoryChapter({ chapter }: StoryChapterProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Chapter Title */}
      <div className="text-center mb-3 sm:mb-4">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 sm:mb-2 px-4">{chapter.title}</h2>
        <div className="w-16 sm:w-20 h-0.5 sm:h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full" />
      </div>

      {(chapter.image || chapter.imageQuery || chapter.imageGenerating) && (
        <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden shadow-xl mb-3 sm:mb-4 bg-secondary/20">
          {chapter.image ? (
            <img
              src={chapter.image}
              alt={chapter.title}
              className="w-full h-full object-cover"
            />
          ) : chapter.imageGenerating ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10">
              <div className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">正在生成图片...</p>
              </div>
            </div>
          ) : chapter.imageQuery ? (
            <Image
              src={`/.jpg?key=h9jiw&height=600&width=1200&query=${encodeURIComponent(chapter.imageQuery!)}`}
              alt={chapter.title}
              fill
              className="object-cover"
              priority
            />
          ) : null}
        </div>
      )}

      {/* Story Content */}
      <Card className="p-4 sm:p-5 md:p-6 bg-card shadow-xl">
        <div className="prose prose-sm sm:prose-base max-w-none">
          <p className="text-sm sm:text-base md:text-lg leading-relaxed whitespace-pre-line text-foreground">
            {chapter.content}
          </p>
        </div>
      </Card>

      {/* Data Cards */}
      {chapter.data && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {Object.entries(chapter.data).map(([key, value]) => {
            const getIcon = () => {
              if (key.includes("asset") || key.includes("Asset"))
                return <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              if (key.includes("target") || key.includes("Target")) return <Target className="w-4 h-4 sm:w-5 sm:h-5" />
              if (key.includes("date") || key.includes("Date")) return <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              return <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            }

            const formatValue = (val: any) => {
              if (typeof val === "number" && val > 1000) {
                return `¥${val.toLocaleString()}`
              }
              if (typeof val === "number" && val < 1) {
                return `${(val * 100).toFixed(1)}%`
              }
              if (typeof val === "boolean") {
                return val ? "是" : "否"
              }
              return val
            }

            const formatKey = (k: string) => {
              const keyMap: Record<string, string> = {
                currentAsset: "当前资产",
                targetAmount: "目标金额",
                progress: "完成度",
                monthlySave: "月存金额",
                expectedReturn: "预期收益",
                targetDate: "目标日期",
                finalAsset: "最终资产",
                achievedEarly: "提前实现",
                monthsEarly: "提前月数",
              }
              return keyMap[k] || k
            }

            return (
              <Card key={key} className="p-2.5 sm:p-3 bg-secondary/50">
                <div className="flex items-center gap-2">
                  <div className="p-1 sm:p-1.5 bg-primary/10 rounded-lg text-primary flex-shrink-0">{getIcon()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{formatKey(key)}</p>
                    <p className="text-sm sm:text-base font-bold truncate">{formatValue(value)}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      {chapter.timeline && chapter.timeline.length > 0 && (
        <Card className="p-3 sm:p-4 md:p-5 bg-card">
          <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            关键时间节点
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {chapter.timeline.map((item, index) => (
              <div key={index} className="flex gap-2.5 sm:gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-primary" />
                  {index < chapter.timeline!.length - 1 && <div className="w-0.5 h-full bg-border mt-1.5" />}
                </div>
                <div className="flex-1 pb-2 sm:pb-3 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">{item.date}</p>
                  <p className="text-xs sm:text-sm font-medium">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

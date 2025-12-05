"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, TrendingUp, Target } from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const [goal, setGoal] = useState("")
  const [currentAsset, setCurrentAsset] = useState("150000")
  const [monthlyIncome, setMonthlyIncome] = useState("12000")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Store data in sessionStorage for next page
    sessionStorage.setItem(
      "financialData",
      JSON.stringify({
        goal,
        currentAsset: Number.parseFloat(currentAsset) || 150000,
        monthlyIncome: Number.parseFloat(monthlyIncome) || 12000,
      }),
    )

    // Simulate loading
    setTimeout(() => {
      router.push("/planning")
    }, 800)
  }

  const examples = ["30岁前在深圳买房", "5年内存够孩子的教育基金"]

  return (
    <div className="min-h-screen relative bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 max-w-4xl relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0">
            <img 
              src="/logo.svg" 
              alt="理财时光机" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#ea9518] via-[#f5a623] to-[#ff8c00] bg-clip-text text-transparent drop-shadow-sm animate-gradient bg-[length:200%_auto]">
            理财时光机
          </h1>
        </div>

        <div className="text-center mb-6 sm:mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-balance bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent px-4 leading-tight drop-shadow-sm tracking-tight">
            你未来想实现什么？
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground/90 max-w-2xl mx-auto text-pretty px-4 leading-relaxed font-medium">
            <span className="inline-block opacity-90">用温暖的故事，</span>
            <span className="inline-block ml-1 opacity-95">帮你看到未来的自己</span>
          </p>
        </div>
        {/* Main Form */}
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-5">
            {/* Goal Input */}
            <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg border border-border">
              <div className="flex items-start gap-2 sm:gap-2.5 mb-2 sm:mb-3">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label htmlFor="goal" className="text-sm sm:text-base font-semibold mb-1.5 block">
                    你的财务目标
                  </Label>
                  <Textarea
                    id="goal"
                    placeholder="用自然语言描述你的目标..."
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="min-h-[80px] sm:min-h-[90px] text-sm sm:text-base resize-none"
                    required
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground">示例：</span>
                    {examples.map((example, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setGoal(example)}
                        className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 rounded-full transition-colors active:scale-95"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Inputs */}
            <div className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg border border-border">
              <div className="flex items-start gap-2 sm:gap-2.5 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-accent/10 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold mb-0.5">当前财务状况</h3>
                  <p className="text-xs text-muted-foreground">可选填写，帮助生成更精准的财务剧本</p>
                </div>
              </div>

              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="currentAsset" className="mb-1.5 block text-xs sm:text-sm">
                    当前资产（元）
                  </Label>
                  <Input
                    id="currentAsset"
                    type="number"
                    placeholder="150000"
                    value={currentAsset}
                    onChange={(e) => setCurrentAsset(e.target.value)}
                    className="text-sm sm:text-base h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="monthlyIncome" className="mb-1.5 block text-xs sm:text-sm">
                    月收入（元）
                  </Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    placeholder="12000"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="text-sm sm:text-base h-10"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={isLoading || !goal}
              className="w-full text-sm sm:text-base h-11 sm:h-12 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  正在准备你的财务剧本...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  生成我的财务剧本
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground px-4">
          <p>不是传统的理财计算器，而是你的人生剧本设计器</p>
        </div>
      </div>
    </div>
  )
}

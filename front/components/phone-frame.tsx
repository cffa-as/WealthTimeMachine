"use client"

import { ReactNode } from "react"

interface PhoneFrameProps {
  children: ReactNode
  className?: string
}

export function PhoneFrame({ children, className = "" }: PhoneFrameProps) {
  // 始终显示手机框（包括web端和移动端）
  return (
    <div className="phone-frame-wrapper">
      <div className={`phone-frame ${className}`}>
        {/* 手机顶部状态栏区域（刘海） */}
        <div className="phone-notch">
          <div className="phone-speaker"></div>
        </div>
        
        {/* 内容区域 */}
        <div className="phone-content">
          {children}
        </div>
        
        {/* 底部安全区域指示器 */}
        <div className="phone-home-indicator"></div>
      </div>
    </div>
  )
}


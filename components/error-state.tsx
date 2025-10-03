"use client"

import { AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = "데이터를 불러오는데 실패했습니다.", onRetry }: ErrorStateProps) {
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold">오류가 발생했습니다</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="text-sm font-medium text-primary hover:underline">
            다시 시도
          </button>
        )}
      </div>
    </Card>
  )
}

"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = "데이터를 불러오는데 실패했습니다.", onRetry }: ErrorStateProps) {
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">오류가 발생했습니다</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            다시 시도
          </Button>
        )}
      </div>
    </Card>
  )
}

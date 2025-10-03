import type { NetflixItem } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface RankCardProps {
  item: NetflixItem
  showChange?: boolean
}

export function RankCard({ item, showChange = true }: RankCardProps) {
  const formatNumber = (num?: number) => {
    if (!num) return "-"
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const getTrendIcon = () => {
    if (!item.changeFromLastWeek) return <Minus className="h-3 w-3" />
    if (item.changeFromLastWeek > 0) return <TrendingUp className="h-3 w-3 text-[color:var(--color-success)]" />
    return <TrendingDown className="h-3 w-3 text-[color:var(--color-destructive)]" />
  }

  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-colors">
      <div className="flex gap-3 p-3">
        {/* Rank Badge */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{item.rank}</span>
          </div>
        </div>

        <div className="flex-shrink-0">
          <div className="w-16 h-24 rounded overflow-hidden bg-muted relative">
            <img
              src={item.poster || "/placeholder.svg?height=300&width=200"}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2">{item.title}</h3>
            {showChange && <div className="flex-shrink-0">{getTrendIcon()}</div>}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="secondary" className="text-xs">
              {item.category}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {item.language}
            </Badge>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            {item.weeklyViews && (
              <div className="flex justify-between">
                <span>Views:</span>
                <span className="font-medium text-foreground">{formatNumber(item.weeklyViews)}</span>
              </div>
            )}
            {item.weeklyHours && (
              <div className="flex justify-between">
                <span>Hours:</span>
                <span className="font-medium text-foreground">{formatNumber(item.weeklyHours)}</span>
              </div>
            )}
            {item.weeksInTop10 && (
              <div className="flex justify-between">
                <span>Weeks in Top10:</span>
                <span className="font-medium text-foreground">{item.weeksInTop10}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

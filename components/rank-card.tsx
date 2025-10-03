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
    if (item.changeFromLastWeek > 0) return <TrendingUp className="h-3 w-3 text-green-500" />
    return <TrendingDown className="h-3 w-3 text-red-500" />
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <div className="flex gap-3 p-4">
        {/* Rank Badge */}
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-lg font-bold">{item.rank}</span>
          </div>
        </div>

        {/* Poster placeholder */}
        <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-muted">
          <img src={item.poster || "/placeholder.svg"} alt={item.title} className="h-full w-full object-cover" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</h3>
            {showChange && <div className="flex-shrink-0">{getTrendIcon()}</div>}
          </div>

          <div className="flex flex-wrap gap-1">
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
                <span className="font-medium">{formatNumber(item.weeklyViews)}</span>
              </div>
            )}
            {item.weeklyHours && (
              <div className="flex justify-between">
                <span>Hours:</span>
                <span className="font-medium">{formatNumber(item.weeklyHours)}</span>
              </div>
            )}
            {item.weeksInTop10 && (
              <div className="flex justify-between">
                <span>Weeks in Top10:</span>
                <span className="font-medium">{item.weeksInTop10}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

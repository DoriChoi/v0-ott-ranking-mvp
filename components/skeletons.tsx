import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function RankCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="flex-shrink-0">
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
        <div className="flex-shrink-0">
          <Skeleton className="w-16 h-24 rounded" />
        </div>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </Card>
  )
}

export function RankGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <RankCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <RankCardSkeleton key={j} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

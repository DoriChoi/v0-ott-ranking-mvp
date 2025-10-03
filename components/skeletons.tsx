import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function RankCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <Skeleton className="h-20 w-14 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-1">
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <RankCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function CategoryGridSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 5 }).map((_, j) => (
              <RankCardSkeleton key={j} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

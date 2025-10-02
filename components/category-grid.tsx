import type { CategoryData } from "@/lib/types"
import { RankCard } from "./rank-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CategoryGridProps {
  data: CategoryData
}

export function CategoryGrid({ data }: CategoryGridProps) {
  const categories = [
    { key: "Films (English)", title: "영화 (영어)" },
    { key: "Films (Non-English)", title: "영화 (비영어)" },
    { key: "TV (English)", title: "TV (영어)" },
    { key: "TV (Non-English)", title: "TV (비영어)" },
  ] as const

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {categories.map(({ key, title }) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data[key]?.length > 0 ? (
              data[key].slice(0, 10).map((item) => <RankCard key={`${key}-${item.rank}`} item={item} />)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

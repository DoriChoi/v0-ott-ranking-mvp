import type { NetflixItem, CategoryData, MostPopularData, WeeklyRow } from "./types"

export const generateSampleWeeklyRows = (): WeeklyRow[] => {
  const titles = [
    "어벤져스1없다",
    "착한 여자 부세미",
    "한승연에 4",
    "신상 프로젝트",
    "탁류",
    "폭군의 세프",
    "우리들의 발라드",
    "Stranger Things S5",
    "The Crown Final",
    "오징어 게임 2",
    "Wednesday S2",
    "The Witcher S4",
    "Bridgerton S3",
    "Money Heist Korea",
    "Sweet Home S3",
    "All of Us Are Dead S2",
    "Kingdom: Ashin",
    "Hellbound S2",
    "D.P. S3",
    "My Name S2",
    "The Glory Part 3",
    "Physical 100 S2",
    "Single's Inferno S4",
    "Extraordinary Attorney Woo S2",
    "Alchemy of Souls S3",
    "Business Proposal S2",
    "Twenty Five Twenty One S2",
    "Our Blues S2",
    "Pachinko S3",
    "The Good Bad Mother S2",
    "King the Land S2",
    "Mask Girl S2",
    "A Time Called You S2",
    "Gyeongseong Creature S2",
    "Chicken Nugget S2",
    "Parasyte: The Grey S2",
    "The 8 Show S2",
    "Hierarchy S2",
    "The Trunk S2",
    "Squid Game: The Challenge S2",
    "Black Knight S2",
    "Bloodhounds S2",
    "Celebrity S2",
    "Doona! S2",
    "Song of the Bandits S2",
    "Ballerina 2",
    "Carter 2",
    "Seoul Vibe 2",
    "Concrete Utopia 2",
    "Ransomed 2",
    "The Roundup: No Way Out 2",
    "Smugglers 2",
    "Killing Romance 2",
    "Dream 2",
    "The Moon 2",
    "Cobweb 2",
    "Project Wolf Hunting 2",
    "Hunt 2",
    "Emergency Declaration 2",
    "Hansan: Rising Dragon 2",
    "The Policeman's Lineage 2",
    "Yaksha: Ruthless Operations 2",
    "Carter 3",
    "Seoul Vibe 3",
    "Concrete Utopia 3",
    "The Call 2",
    "Space Sweepers 2",
    "Time to Hunt 2",
    "Forgotten 2",
    "The Witch: Part 2",
    "Seobok 2",
    "Escape from Mogadishu 2",
    "Peninsula 2",
    "The Divine Fury 2",
    "Ashfall 2",
    "Exit 2",
    "Extreme Job 2",
    "The Gangster, The Cop, The Devil 2",
    "Parasite: The Musical",
    "Burning 2",
    "The Handmaiden 2",
    "Train to Busan 3",
    "The Wailing 2",
    "Oldboy Remake",
    "Memories of Murder 2",
    "Mother 2",
    "The Chaser 2",
    "I Saw the Devil 2",
    "The Man from Nowhere 2",
    "A Bittersweet Life 2",
    "Sympathy for Mr. Vengeance 2",
    "Joint Security Area 2",
    "Peppermint Candy 2",
    "Christmas in August 2",
    "Spring, Summer, Fall, Winter... and Spring 2",
  ]

  const categories: Array<"TV" | "Films"> = ["TV", "Films"]
  const languages: Array<"English" | "Non-English"> = ["English", "Non-English"]

  const weekStart = "2025-01-27"
  const weekEnd = "2025-02-02"

  return titles.map((title, index) => ({
    weekStart,
    weekEnd,
    title,
    category: categories[index % 2],
    languageType: languages[index % 2],
    hoursViewed: Math.floor(Math.random() * 50000000) + 10000000,
    views: Math.floor(Math.random() * 30000000) + 5000000,
    weeksInTop10: Math.floor(Math.random() * 10) + 1,
  }))
}

export const sampleWeeklyRows = generateSampleWeeklyRows()

export const sampleWeeklyData: NetflixItem[] = sampleWeeklyRows.slice(0, 100).map((row, index) => ({
  rank: index + 1,
  title: row.title,
  category: row.category,
  language: row.languageType,
  weeklyViews: row.views,
  weeklyHours: row.hoursViewed,
  weeksInTop10: row.weeksInTop10,
  changeFromLastWeek: Math.floor(Math.random() * 10) - 5,
  poster: `/placeholder.svg?height=300&width=200&query=${encodeURIComponent(row.title)}`,
}))

export const sampleCategoryData: CategoryData = {
  "Films (English)": sampleWeeklyData
    .filter((item) => item.category === "Films" && item.language === "English")
    .slice(0, 10),
  "Films (Non-English)": sampleWeeklyData
    .filter((item) => item.category === "Films" && item.language === "Non-English")
    .slice(0, 10),
  "TV (English)": sampleWeeklyData.filter((item) => item.category === "TV" && item.language === "English").slice(0, 10),
  "TV (Non-English)": sampleWeeklyData
    .filter((item) => item.category === "TV" && item.language === "Non-English")
    .slice(0, 10),
}

export const sampleMostPopular: MostPopularData[] = [
  {
    category: "Films (English)",
    items: sampleWeeklyData
      .filter((item) => item.category === "Films" && item.language === "English")
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        title: item.title,
        category: item.category,
        language: item.language,
        cumulativeViews: item.weeklyViews * 3,
        cumulativeHours: item.weeklyHours * 3,
        poster: item.poster,
      })),
  },
  {
    category: "Films (Non-English)",
    items: sampleWeeklyData
      .filter((item) => item.category === "Films" && item.language === "Non-English")
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        title: item.title,
        category: item.category,
        language: item.language,
        cumulativeViews: item.weeklyViews * 3,
        cumulativeHours: item.weeklyHours * 3,
        poster: item.poster,
      })),
  },
  {
    category: "TV (English)",
    items: sampleWeeklyData
      .filter((item) => item.category === "TV" && item.language === "English")
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        title: item.title,
        category: item.category,
        language: item.language,
        cumulativeViews: item.weeklyViews * 3,
        cumulativeHours: item.weeklyHours * 3,
        poster: item.poster,
      })),
  },
  {
    category: "TV (Non-English)",
    items: sampleWeeklyData
      .filter((item) => item.category === "TV" && item.language === "Non-English")
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        title: item.title,
        category: item.category,
        language: item.language,
        cumulativeViews: item.weeklyViews * 3,
        cumulativeHours: item.weeklyHours * 3,
        poster: item.poster,
      })),
  },
]

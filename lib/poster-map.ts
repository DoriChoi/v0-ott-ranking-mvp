// Simple keyword-based local poster resolver for sample titles
// Returns a path under /public or undefined
export function getLocalPoster(title: string): string | undefined {
  const t = title.toLowerCase()
  const rules: Array<[RegExp, string]> = [
    [/stranger\s*things|기묘한|stranger/, "/stranger-things-inspired-poster.png"],
    [/the\s*crown|크라운/, "/the-crown-poster.jpg"],
    [/chef|셰프|세프/, "/chef-tv-show-poster.jpg"],
    [/ballerina|발레리나/, "/asian-drama-poster.jpg"],
    [/squid\s*game|오징어\s*게임/, "/generic-survival-game-poster.png"],
    [/avengers|어벤져스/, "/generic-superhero-team-poster.png"],
    [/project|프로젝트/, "/project-movie-poster.jpg"],
    [/drama|드라마|melodrama|발라드|ballad/, "/ballad-tv-show-poster.jpg"],
    [/red\s*notice|레드\s*노티스/, "/red-notice-poster.jpg"],
    [/concrete\s*utopia|콘크리트\s*유토피아/, "/concrete-utopia-2.jpg"], // may not exist; fallback will handle
    [/hellbound|지옥/, "/korean-movie-poster.jpg"],
    // From screenshot: add sequels/season 2 and KR/EN pairs
    [/emergency\s*declaration|비상\s*선언/, "/korean-movie-poster.jpg"],
    [/peninsula|반도/, "/korean-movie-poster.jpg"],
    [/the\s*challenge|챌린지/, "/generic-survival-game-poster.png"],
    [/concrete\s*utopia\s*2|콘크리트\s*유토피아\s*2/, "/concrete-utopia-2.jpg"],
    [/exit\s*2|엑시트\s*2/, "/korean-movie-poster.jpg"],
    [/our\s*ballad|우리들의\s*발라드/, "/ballad-tv-show-poster.jpg"],
    [/mogadishu|모가디슈/, "/korean-movie-poster.jpg"],
    [/chicken\s*nugget|치킨\s*너겟/, "/asian-drama-poster.jpg"],
    [/폭군의\s*셰프|폭군의\s*세프|tyrant.*chef/i, "/chef-tv-show-poster.jpg"],
    // User-reported missing examples
    [/한\s*승\s*연|han\s*seung\s*yeon/i, "/asian-drama-poster.jpg"],
    [/doona\s*rhee|배\s*두\s*나/i, "/asian-drama-poster.jpg"],
    [/k[-\s]?1|k1|burning\s*2000/i, "/korean-movie-poster.jpg"],
    // New reports
    [/all\s*of\s*us\s*are\s*dead/i, "/generic-survival-game-poster.png"],
    [/dead\s*and\s*buried/i, "/korean-movie-poster.jpg"],
    [/신상\s*프로젝트/, "/project-movie-poster.jpg"],
  ]

  for (const [re, path] of rules) {
    if (re.test(t)) return path
  }
  // generic Korean/TV/movie fallbacks
  if (/[가-힣]/.test(title)) return "/korean-movie-poster.jpg"
  return undefined
}
